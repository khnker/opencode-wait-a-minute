import { AGENT_ROLES, assertAgentRequest } from "./role-contracts.js";
import { selectRoleContext } from "./context-isolation.js";

export const AGENT_PIPELINE = Object.freeze([
  AGENT_ROLES.ANALYST,
  AGENT_ROLES.ARCHITECT,
  AGENT_ROLES.BUILDER,
  AGENT_ROLES.REVIEWER,
]);

const ROLE_INSTRUCTIONS = Object.freeze({
  [AGENT_ROLES.ANALYST]: "Analyze the task and report evidence-backed findings",
  [AGENT_ROLES.ARCHITECT]: "Design the implementation strategy for the task",
  [AGENT_ROLES.BUILDER]: "Implement the approved strategy for the task",
  [AGENT_ROLES.REVIEWER]: "Review the implementation and evidence for the task",
});

const EXPECTED_OUTPUT = Object.freeze({
  [AGENT_ROLES.ANALYST]: ["findings", "openQuestions", "evidence", "limitations"],
  [AGENT_ROLES.ARCHITECT]: ["decisions", "recommendations", "limitations"],
  [AGENT_ROLES.BUILDER]: ["artifacts", "evidence", "limitations"],
  [AGENT_ROLES.REVIEWER]: ["review.verdict", "review.findings", "review.limitations"],
});

const STOP_STATUSES = new Set(["BLOCKED", "NEEDS_INPUT", "FAILED"]);

export class AgentOrchestrationError extends Error {
  constructor(issues) {
    const list = Array.isArray(issues) ? issues : [issues];
    super(`Agent orchestration violation: ${list.join("; ")}`);
    this.name = "AgentOrchestrationError";
    this.issues = Object.freeze([...list]);
  }
}

function validateOrchestrationInput({
  taskId,
  objective,
  acceptanceCriteria,
  adapter,
  contextSelector,
  artifacts,
  evidence,
  constraints,
  priorFindings,
  maxChars,
  maxCharsPerSource,
  maxRevisionCycles,
  maxReplanCycles,
}) {
  const issues = [];
  if (typeof taskId !== "string" || taskId.trim() === "") {
    issues.push("taskId must be a non-empty string");
  }
  if (typeof objective !== "string" || objective.trim() === "") {
    issues.push("objective must be a non-empty string");
  }
  if (!Array.isArray(acceptanceCriteria)) {
    issues.push("acceptanceCriteria must be an array");
  }
  if (typeof adapter?.invoke !== "function") {
    issues.push("adapter.invoke must be a function");
  }
  if (typeof contextSelector !== "function") {
    issues.push("contextSelector must be a function");
  }
  for (const [name, value] of Object.entries({
    artifacts,
    evidence,
    constraints,
    priorFindings,
  })) {
    if (!Array.isArray(value)) issues.push(`${name} must be an array`);
  }
  for (const [name, value] of Object.entries({
    maxChars,
    maxCharsPerSource,
    maxRevisionCycles,
    maxReplanCycles,
  })) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      issues.push(`${name} must be a non-negative integer`);
    }
  }
  if (maxChars === 0) issues.push("maxChars must be greater than zero");
  if (maxCharsPerSource === 0) {
    issues.push("maxCharsPerSource must be greater than zero");
  }
  if (issues.length) throw new AgentOrchestrationError(issues);
}

function decisionConstraint(decision) {
  return `Decision ${decision.id}: ${decision.description} (${decision.rationale})`;
}

function openQuestionConstraint(question) {
  return `Open question: ${question}`;
}

function reviewFindingConstraint(finding) {
  const criterion = finding.criterionId ? `, ${finding.criterionId}` : "";
  const evidence = finding.evidence.length
    ? ` | evidence: ${finding.evidence.join(", ")}`
    : "";
  return `Review finding (${finding.severity}${criterion}): ${finding.description} | corrective action: ${finding.correctiveAction}${evidence}`;
}

async function executeOrchestration({
  taskId,
  objective,
  acceptanceCriteria,
  artifacts = [],
  evidence = [],
  constraints = [],
  priorFindings = [],
  adapter,
  contextSelector = selectRoleContext,
  maxChars,
  maxCharsPerSource,
  maxRevisionCycles = 0,
  maxReplanCycles = 0,
} = {}) {
  validateOrchestrationInput({
    taskId,
    objective,
    acceptanceCriteria,
    adapter,
    contextSelector,
    artifacts,
    evidence,
    constraints,
    priorFindings,
    maxChars,
    maxCharsPerSource,
    maxRevisionCycles,
    maxReplanCycles,
  });

  const results = [];
  const handoffs = [];
  const context = [];
  const baseConstraints = [...constraints];
  const accumulated = {
    artifacts: [...artifacts],
    evidence: [...evidence],
    constraints: [...constraints],
    findings: [...priorFindings],
  };
  const invocationCounts = Object.fromEntries(
    AGENT_PIPELINE.map((role) => [role, 0]),
  );
  const cycles = { revisions: 0, replans: 0 };

  const finish = (status, stoppedAt, verdict = null, extra = {}) => ({
    taskId,
    status,
    verdict,
    stoppedAt,
    results,
    handoffs,
    context,
    cycles: { ...cycles },
    exhausted: false,
    ...extra,
  });

  const nextInvocationId = (role) => {
    invocationCounts[role] += 1;
    return `${taskId}:${role}:${invocationCounts[role]}`;
  };

  const invokeRole = async (role, nextRole = null, kind = "pipeline") => {
    const invocationId = nextInvocationId(role);
    const roleObjective = `${ROLE_INSTRUCTIONS[role]}: ${objective}`;
    const selection = contextSelector({
      role,
      objective: roleObjective,
      artifacts: accumulated.artifacts,
      evidence: accumulated.evidence,
      constraints: accumulated.constraints,
      priorFindings: accumulated.findings,
      maxChars,
      maxCharsPerSource,
    });
    if (!selection?.input || !selection?.metadata) {
      throw new AgentOrchestrationError(
        `contextSelector returned an invalid selection for ${role}`,
      );
    }

    const request = {
      taskId,
      invocationId,
      role,
      objective: roleObjective,
      acceptanceCriteria,
      input: selection.input,
      expectedOutput: EXPECTED_OUTPUT[role],
    };
    assertAgentRequest(request);

    const invocation = await adapter.invoke(request);
    if (!invocation?.result) {
      throw new AgentOrchestrationError(`adapter returned no result for ${role}`);
    }
    const { result } = invocation;
    const metadata = invocation.metadata ?? {};

    results.push({ role, invocationId, result, metadata });
    context.push({ role, metadata: selection.metadata });

    if (nextRole && result.status === "COMPLETED") {
      handoffs.push({
        kind,
        from: role,
        to: nextRole,
        findings: [...result.findings],
        decisions: [...result.decisions],
        artifacts: [...result.artifacts],
        evidence: [...result.evidence],
      });
    }

    accumulated.findings.push(...result.findings);
    accumulated.artifacts.push(...result.artifacts);
    accumulated.evidence.push(...result.evidence);
    for (const decision of result.decisions) {
      accumulated.constraints.push(decisionConstraint(decision));
    }
    for (const question of result.openQuestions) {
      accumulated.constraints.push(openQuestionConstraint(question));
    }
    for (const finding of result.review?.findings ?? []) {
      accumulated.constraints.push(reviewFindingConstraint(finding));
    }

    return result;
  };

  const terminalResult = (result, role) =>
    STOP_STATUSES.has(result.status) ? finish(result.status, role) : null;

  const runReviewer = async () => {
    const result = await invokeRole(AGENT_ROLES.REVIEWER);
    const terminal = terminalResult(result, AGENT_ROLES.REVIEWER);
    if (terminal) return { terminal, result };
    const verdict = result.review?.verdict;
    if (!verdict) {
      throw new AgentOrchestrationError(
        `reviewer result for ${result.invocationId} has no verdict`,
      );
    }
    return { result, verdict };
  };

  const stopForFeedback = (verdict, reviewFindings) => {
    if (verdict === "REVISION_REQUIRED") {
      if (cycles.revisions >= maxRevisionCycles) {
        return finish("REVISION_REQUIRED", AGENT_ROLES.REVIEWER, verdict, {
          exhausted: true,
        });
      }
      cycles.revisions += 1;
      handoffs.push({
        kind: "revision",
        from: AGENT_ROLES.REVIEWER,
        to: AGENT_ROLES.BUILDER,
        findings: [],
        decisions: [],
        artifacts: [],
        evidence: [],
        reviewFindings: [...reviewFindings],
      });
      return null;
    }
    if (verdict === "REPLAN_REQUIRED") {
      if (cycles.replans >= maxReplanCycles) {
        return finish("REPLAN_REQUIRED", AGENT_ROLES.REVIEWER, verdict, {
          exhausted: true,
        });
      }
      cycles.replans += 1;
      handoffs.push({
        kind: "replan",
        from: AGENT_ROLES.REVIEWER,
        to: AGENT_ROLES.ARCHITECT,
        findings: [],
        decisions: [],
        artifacts: [],
        evidence: [],
        reviewFindings: [...reviewFindings],
      });
      accumulated.constraints = [
        ...baseConstraints,
        ...reviewFindings.map(reviewFindingConstraint),
      ];
      return null;
    }
    return null;
  };

  let result = await invokeRole(AGENT_ROLES.ANALYST, AGENT_ROLES.ARCHITECT);
  let terminal = terminalResult(result, AGENT_ROLES.ANALYST);
  if (terminal) return terminal;

  result = await invokeRole(AGENT_ROLES.ARCHITECT, AGENT_ROLES.BUILDER);
  terminal = terminalResult(result, AGENT_ROLES.ARCHITECT);
  if (terminal) return terminal;

  result = await invokeRole(AGENT_ROLES.BUILDER, AGENT_ROLES.REVIEWER);
  terminal = terminalResult(result, AGENT_ROLES.BUILDER);
  if (terminal) return terminal;

  let review = await runReviewer();
  if (review.terminal) return review.terminal;

  while (true) {
    const verdict = review.verdict;
    if (verdict === "ACCEPTED") {
      return finish("COMPLETED", null, verdict);
    }
    if (verdict === "BLOCKED") {
      return finish("BLOCKED", AGENT_ROLES.REVIEWER, verdict);
    }
    if (verdict !== "REVISION_REQUIRED" && verdict !== "REPLAN_REQUIRED") {
      throw new AgentOrchestrationError(
        `unknown reviewer verdict: ${String(verdict)}`,
      );
    }

    const reviewFindings = review.result.review?.findings ?? [];
    const feedbackStop = stopForFeedback(verdict, reviewFindings);
    if (feedbackStop) return feedbackStop;

    if (verdict === "REPLAN_REQUIRED") {
      result = await invokeRole(
        AGENT_ROLES.ARCHITECT,
        AGENT_ROLES.BUILDER,
        "replan",
      );
      terminal = terminalResult(result, AGENT_ROLES.ARCHITECT);
      if (terminal) return terminal;
    }

    result = await invokeRole(
      AGENT_ROLES.BUILDER,
      AGENT_ROLES.REVIEWER,
      verdict === "REPLAN_REQUIRED" ? "replan" : "revision",
    );
    terminal = terminalResult(result, AGENT_ROLES.BUILDER);
    if (terminal) return terminal;

    review = await runReviewer();
    if (review.terminal) return review.terminal;
  }
}

export async function runAgentOrchestration(options = {}) {
  return executeOrchestration({
    ...options,
    maxRevisionCycles: 0,
    maxReplanCycles: 0,
  });
}

export async function runAgentFeedbackOrchestration({
  maxRevisionCycles = 2,
  maxReplanCycles = 1,
  ...options
} = {}) {
  return executeOrchestration({
    ...options,
    maxRevisionCycles,
    maxReplanCycles,
  });
}
