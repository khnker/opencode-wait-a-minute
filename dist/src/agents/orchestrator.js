import {
  AGENT_ROLES,
  RoleContractError,
  assertAgentRequest,
  isBuilderRole,
} from "./role-contracts.js";
import { assertInvocationResult } from "./result-boundary.js";
import { selectRoleContext } from "./context-isolation.js";
import {
  assertReviewArtifacts,
  detectReviewArtifactFailure,
} from "./review-artifacts.js";
import { buildApprovedStrategy } from "./approved-strategy.js";
import { resolveResourceLimits } from "./resource-policy.js";

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
  [AGENT_ROLES.BACKEND_ENGINEER]: "Implement the approved backend strategy for the task",
  [AGENT_ROLES.FRONTEND_ENGINEER]: "Implement the approved frontend strategy for the task",
  [AGENT_ROLES.REVIEWER]: "Review the implementation and evidence for the task",
});

const EXPECTED_OUTPUT = Object.freeze({
  [AGENT_ROLES.ANALYST]: ["findings", "openQuestions", "evidence", "limitations"],
  [AGENT_ROLES.ARCHITECT]: ["decisions", "recommendations", "limitations"],
  [AGENT_ROLES.BUILDER]: ["artifacts", "evidence", "limitations"],
  [AGENT_ROLES.BACKEND_ENGINEER]: ["artifacts", "evidence", "limitations"],
  [AGENT_ROLES.FRONTEND_ENGINEER]: ["artifacts", "evidence", "limitations"],
  [AGENT_ROLES.REVIEWER]: ["review.verdict", "review.findings", "review.limitations"],
});

const STOP_STATUSES = new Set(["BLOCKED", "NEEDS_INPUT", "FAILED"]);

export class AgentOrchestrationError extends Error {
  constructor(issues, { cause } = {}) {
    const list = Array.isArray(issues) ? issues : [issues];
    super(
      `Agent orchestration violation: ${list.join("; ")}`,
      cause === undefined ? undefined : { cause },
    );
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
  reviewArtifacts,
  maxChars,
  maxCharsPerSource,
  maxRevisionCycles,
  maxReplanCycles,
  implementationRole,
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
    reviewArtifacts,
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
  if (implementationRole !== undefined && !isBuilderRole(implementationRole)) {
    issues.push(`implementationRole must be a builder role: ${String(implementationRole)}`);
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

export function requireApprovedStrategy(approvedStrategy, invocationId) {
  if (!approvedStrategy || typeof approvedStrategy !== "object") {
    throw new AgentOrchestrationError(
      `BUILDER invocation ${invocationId} requires an approved strategy from ARCHITECT`,
    );
  }
  return approvedStrategy;
}

async function invokeWithTimeout(adapter, request, role, invocationId, timeoutMs) {
  if (!timeoutMs) {
    return adapter.invoke(request);
  }

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AgentOrchestrationError(
          `invocation timed out after ${timeoutMs}ms for role ${role} (${invocationId})`,
        ),
      );
    }, timeoutMs);
  });
  const invocation = Promise.resolve().then(() => adapter.invoke(request));

  try {
    return await Promise.race([invocation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function executeOrchestration({
  taskId,
  objective,
  acceptanceCriteria,
  artifacts = [],
  evidence = [],
  constraints = [],
  priorFindings = [],
  reviewArtifacts = [],
  adapter,
  contextSelector = selectRoleContext,
  maxChars,
  maxCharsPerSource,
  maxRevisionCycles = 0,
  maxReplanCycles = 0,
  mode = "IMPLEMENT",
  implementationRole = AGENT_ROLES.BUILDER,
  resourceLimits,
} = {}) {
  let limits;
  try {
    limits = resolveResourceLimits(resourceLimits);
  } catch (cause) {
    throw new AgentOrchestrationError(cause.issues ?? cause.message, { cause });
  }
  if (mode !== "IMPLEMENT" && mode !== "ANALYZE") {
    throw new AgentOrchestrationError(`unknown orchestration mode: ${String(mode)}`);
  }

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
    reviewArtifacts,
    maxChars,
    maxCharsPerSource,
    maxRevisionCycles,
    maxReplanCycles,
    implementationRole,
  });

  let normalizedReviewArtifacts;
  try {
    normalizedReviewArtifacts = assertReviewArtifacts(reviewArtifacts);
  } catch (cause) {
    throw new AgentOrchestrationError(cause.issues ?? cause.message, { cause });
  }

  const results = [];
  const handoffs = [];
  const context = [];
  const baseConstraints = [...constraints];
  let approvedStrategy = null;
  const accumulated = {
    artifacts: [...artifacts],
    evidence: [...evidence],
    constraints: [...constraints],
    findings: [...priorFindings],
  };
  const invocationCounts = Object.fromEntries(
    [...AGENT_PIPELINE, implementationRole].map((role) => [role, 0]),
  );
  let totalInvocations = 0;
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
    const actualRole = role === AGENT_ROLES.BUILDER ? implementationRole : role;
    const invocationId = nextInvocationId(actualRole);
    totalInvocations += 1;
    if (totalInvocations > limits.maxInvocations) {
      throw new AgentOrchestrationError(
        `invocation limit exceeded (${totalInvocations} > ${limits.maxInvocations}) for role ${actualRole} (${invocationId})`,
      );
    }
    const roleObjective = `${ROLE_INSTRUCTIONS[actualRole]}: ${objective}`;
    const selection = contextSelector({
      role: actualRole,
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
        `contextSelector returned an invalid selection for ${actualRole}`,
      );
    }

    const request = {
      taskId,
      invocationId,
      role: actualRole,
      objective: roleObjective,
      acceptanceCriteria,
      input: {
        ...selection.input,
        ...(actualRole === AGENT_ROLES.REVIEWER &&
        normalizedReviewArtifacts.length > 0
          ? { reviewArtifacts: normalizedReviewArtifacts }
          : {}),
        ...(isBuilderRole(actualRole)
          ? {
              approvedStrategy: requireApprovedStrategy(
                approvedStrategy,
                invocationId,
              ),
            }
          : {}),
      },
      expectedOutput: EXPECTED_OUTPUT[actualRole],
    };
    assertAgentRequest(request);

    const invocation = await invokeWithTimeout(
      adapter,
      request,
      actualRole,
      invocationId,
      limits.maxInvocationMs,
    );
    if (!invocation?.result) {
      throw new AgentOrchestrationError(`adapter returned no result for ${actualRole}`);
    }
    let validated;
    try {
      validated = assertInvocationResult({
        request,
        invocation,
        resourceLimits: limits,
      });
    } catch (cause) {
      if (cause instanceof RoleContractError) {
        throw new AgentOrchestrationError(
          `invalid result for role ${actualRole} (${invocationId}): ${cause.message}`,
          { cause },
        );
      }
      throw cause;
    }
    const { result, metadata } = validated;

    results.push({ role: actualRole, invocationId, result, metadata });
    context.push({ role: actualRole, metadata: selection.metadata });

    if (nextRole && result.status === "COMPLETED") {
      handoffs.push({
        kind,
        from: actualRole,
        to: nextRole === AGENT_ROLES.BUILDER ? implementationRole : nextRole,
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

  const terminalResult = (result) =>
    STOP_STATUSES.has(result.status) ? finish(result.status, result.role) : null;

  const runReviewer = async () => {
    const result = await invokeRole(AGENT_ROLES.REVIEWER);
    const terminal = terminalResult(result);
    if (terminal) return { terminal, result };
    let verdict = result.review?.verdict;
    if (!verdict) {
      throw new AgentOrchestrationError(
        `reviewer result for ${result.invocationId} has no verdict`,
      );
    }
    if (verdict === "ACCEPTED" && cycles.revisions === 0) {
      const failure = detectReviewArtifactFailure(normalizedReviewArtifacts);
      if (failure) {
        result.review = {
          ...result.review,
          verdict: "REVISION_REQUIRED",
          findings: [
            ...(Array.isArray(result.review.findings)
              ? result.review.findings
              : []),
            {
              id: `artifact-failure-${result.invocationId}`,
              severity: "CRITICAL",
              criterionId: "outcome-evaluation",
              description: `Review artifact ${failure.ref} reports a failing test; the reviewer accepted despite the failure.`,
              correctiveAction:
                "Fix the failing test or provide newer evidence that the artifact is stale.",
              evidence: [failure.ref],
            },
          ],
        };
        verdict = "REVISION_REQUIRED";
      }
    }
    return { result, verdict };
  };

  const stopForFeedback = (
    verdict,
    reviewFindings,
    { revisionTo = AGENT_ROLES.BUILDER, applyRevisionFindings = false } = {},
  ) => {
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
        to: revisionTo,
        findings: [],
        decisions: [],
        artifacts: [],
        evidence: [],
        reviewFindings: [...reviewFindings],
      });
      if (applyRevisionFindings) {
        accumulated.constraints = [
          ...baseConstraints,
          ...reviewFindings.map(reviewFindingConstraint),
        ];
      }
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

  if (mode === "ANALYZE") {
    let result = await invokeRole(AGENT_ROLES.ANALYST, AGENT_ROLES.ARCHITECT);
    let terminal = terminalResult(result);
    if (terminal) return terminal;

    result = await invokeRole(AGENT_ROLES.ARCHITECT, AGENT_ROLES.REVIEWER);
    terminal = terminalResult(result);
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
      const feedbackStop = stopForFeedback(verdict, reviewFindings, {
        revisionTo: AGENT_ROLES.ARCHITECT,
        applyRevisionFindings: true,
      });
      if (feedbackStop) return feedbackStop;

      if (verdict === "REVISION_REQUIRED") {
        result = await invokeRole(
          AGENT_ROLES.ANALYST,
          AGENT_ROLES.ARCHITECT,
          "revision",
        );
        terminal = terminalResult(result);
        if (terminal) return terminal;
      }

      result = await invokeRole(
        AGENT_ROLES.ARCHITECT,
        AGENT_ROLES.REVIEWER,
        verdict === "REPLAN_REQUIRED" ? "replan" : "revision",
      );
      terminal = terminalResult(result);
      if (terminal) return terminal;

      review = await runReviewer();
      if (review.terminal) return review.terminal;
    }
  }

  let result = await invokeRole(AGENT_ROLES.ANALYST, AGENT_ROLES.ARCHITECT);
  let terminal = terminalResult(result);
  if (terminal) return terminal;

  result = await invokeRole(AGENT_ROLES.ARCHITECT, AGENT_ROLES.BUILDER);
  terminal = terminalResult(result);
  if (terminal) return terminal;
  approvedStrategy = buildApprovedStrategy({
    decisions: result.decisions,
    constraints: accumulated.constraints,
  });

  result = await invokeRole(AGENT_ROLES.BUILDER, AGENT_ROLES.REVIEWER);
  terminal = terminalResult(result);
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
      terminal = terminalResult(result);
      if (terminal) return terminal;
      approvedStrategy = buildApprovedStrategy({
        decisions: result.decisions,
        constraints: accumulated.constraints,
      });
    }

    result = await invokeRole(
      AGENT_ROLES.BUILDER,
      AGENT_ROLES.REVIEWER,
      verdict === "REPLAN_REQUIRED" ? "replan" : "revision",
    );
    terminal = terminalResult(result);
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
