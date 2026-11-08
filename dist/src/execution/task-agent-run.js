import { runAgentFeedbackOrchestration } from "../agents/orchestrator.js";
import { builderRoleForLayer } from "../agents/role-contracts.js";
import { normalizeReviewArtifacts } from "../agents/review-artifacts.js";
import { detectLayer } from "../skills/skill-routing.js";
import { carriesSurfaced } from "./agent-run-state.js";
import { decideAgentLoopAction } from "./task-loop.js";

export class AgentTaskIntegrationError extends Error {
  constructor(issues) {
    const list = Array.isArray(issues) ? issues : [issues];
    super(list.join("; "));
    this.name = "AgentTaskIntegrationError";
    this.issues = list;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!nonEmptyString(value)) continue;
    const text = value.trim();
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function evidenceReference(item) {
  if (nonEmptyString(item)) return item;
  if (!isObject(item)) return null;
  return (
    (nonEmptyString(item.ref) && item.ref) ||
    (nonEmptyString(item.path) && item.path) ||
    (nonEmptyString(item.id) && item.id) ||
    (nonEmptyString(item.description) && item.description) ||
    (nonEmptyString(item.type) && item.type) ||
    null
  );
}

function collectEvidence(task) {
  const direct = [
    ...asArray(task.evidenceRefs),
    ...asArray(task.outcomeContract?.evidenceRefs),
    ...asArray(task.evidence),
    ...asArray(task.verification?.evidence),
    ...asArray(task.outcomeContract?.evidence),
  ];
  const requirementEvidence = asArray(task.requirements).flatMap((requirement) =>
    asArray(requirement?.evidence),
  );
  return uniqueStrings([...direct, ...requirementEvidence].map(evidenceReference));
}

function collectArtifacts(task) {
  return uniqueStrings([
    ...asArray(task.artifacts),
    ...asArray(task.changedFiles),
    ...asArray(task.files),
    ...asArray(task.outcomeContract?.artifacts),
  ]);
}

function collectConstraints(task) {
  return uniqueStrings([
    ...asArray(task.constraints),
    ...asArray(task.contract?.constraints),
    ...asArray(task.outcomeContract?.constraints),
  ]);
}

function normalizeCriterion(criterion, index, ids) {
  const idBase = nonEmptyString(criterion?.id) ? criterion.id.trim() : `criterion-${index + 1}`;
  let id = idBase;
  let suffix = 2;
  while (ids.has(id)) {
    id = `${idBase}-${suffix}`;
    suffix += 1;
  }
  ids.add(id);
  const description =
    (nonEmptyString(criterion?.description) && criterion.description) ||
    (nonEmptyString(criterion?.title) && criterion.title) ||
    id;
  const normalized = {
    id,
    description,
    mandatory: typeof criterion?.mandatory === "boolean" ? criterion.mandatory : true,
  };
  if (isObject(criterion?.evidenceRequirements)) {
    normalized.evidenceRequirements = { ...criterion.evidenceRequirements };
  }
  return normalized;
}

function normalizeCriteria(task, objective) {
  const declared =
    asArray(task.outcomeContract?.acceptanceCriteria).length > 0
      ? task.outcomeContract.acceptanceCriteria
      : asArray(task.acceptanceCriteria).length > 0
        ? task.acceptanceCriteria
        : asArray(task.requirements);
  const source = declared.filter(isObject);
  if (source.length === 0) {
    return [{ id: "task-outcome", description: objective, mandatory: true }];
  }
  const ids = new Set();
  return source.map((criterion, index) => normalizeCriterion(criterion, index, ids));
}

function collectPriorFindings(task) {
  const results = asArray(task.agentRun?.results);
  const findings = results.flatMap((entry) => asArray(entry?.result?.findings));
  return findings
    .filter(
      (finding) =>
        isObject(finding) &&
        nonEmptyString(finding.id) &&
        nonEmptyString(finding.description) &&
        nonEmptyString(finding.severity) &&
        Array.isArray(finding.evidence),
    )
    .map((finding) => ({ ...finding, evidence: [...finding.evidence] }));
}

function objectiveFor(task) {
  return (
    (nonEmptyString(task.outcomeContract?.objective) && task.outcomeContract.objective) ||
    (nonEmptyString(task.objective) && task.objective) ||
    (nonEmptyString(task.request) && task.request) ||
    (nonEmptyString(task.title) && task.title) ||
    (nonEmptyString(task.description) && task.description) ||
    null
  );
}

function reviewArtifactValues(task) {
  const values = [];
  if (Array.isArray(task.reviewArtifacts)) {
    values.push(...task.reviewArtifacts);
  } else if (task.reviewArtifacts !== undefined) {
    values.push(task.reviewArtifacts);
  }
  for (const field of ["diff", "patch"]) {
    const value = task[field];
    if (typeof value === "string") {
      values.push({ ref: field, content: value });
    } else if (isObject(value)) {
      values.push({
        ref: value.ref ?? value.path ?? value.id ?? field,
        content: value.content ?? value.diff ?? value.patch,
      });
    }
  }
  return values;
}

function implementationRoleFor(task, artifacts) {
  const explicit = task?.layer || task?.implementationLayer;
  if (explicit) return builderRoleForLayer(explicit);
  for (const artifact of artifacts) {
    const layer = detectLayer(String(artifact));
    if (layer) return builderRoleForLayer(layer);
  }
  return builderRoleForLayer(null);
}

export function buildTaskAgentInput(task) {
  if (!isObject(task)) {
    throw new AgentTaskIntegrationError("task snapshot is required");
  }
  const taskId = task.id || task.taskId || task.task_id;
  if (!nonEmptyString(taskId)) {
    throw new AgentTaskIntegrationError("task.id or task.taskId is required");
  }
  const objective = objectiveFor(task);
  if (!objective) {
    throw new AgentTaskIntegrationError("task objective is required");
  }
  const artifacts = collectArtifacts(task);
  return {
    taskId,
    objective,
    acceptanceCriteria: normalizeCriteria(task, objective),
    artifacts,
    evidence: collectEvidence(task),
    constraints: collectConstraints(task),
    priorFindings: collectPriorFindings(task),
    reviewArtifacts: normalizeReviewArtifacts(reviewArtifactValues(task)),
    implementationRole: implementationRoleFor(task, artifacts),
    mode: task.executionIntent === "ANALYZE" ? "ANALYZE" : "IMPLEMENT",
  };
}

function cloneFindings(findings) {
  return asArray(findings)
    .filter(isObject)
    .map((finding) => ({ ...finding, evidence: asArray(finding.evidence).slice() }));
}

function cloneDecisions(decisions) {
  return asArray(decisions)
    .filter(isObject)
    .map((decision) => ({ ...decision }));
}

function summarizeResult(entry) {
  const result = entry?.result ?? {};
  return {
    role: entry?.role ?? result.role ?? null,
    invocationId: entry?.invocationId ?? result.invocationId ?? null,
    status: result.status ?? null,
    summary: result.summary ?? "",
    findings: cloneFindings(result.findings),
    decisions: cloneDecisions(result.decisions),
    artifacts: asArray(result.artifacts).slice(),
    evidence: asArray(result.evidence).slice(),
    review: isObject(result.review) ? { ...result.review } : null,
    metadata: isObject(entry?.metadata) ? { ...entry.metadata } : {},
  };
}

function summaryEntry(outcome, resultCount, now) {
  return {
    status: outcome.status ?? null,
    verdict: outcome.verdict ?? null,
    stoppedAt: outcome.stoppedAt ?? null,
    exhausted: outcome.exhausted === true,
    cycles: isObject(outcome.cycles) ? { ...outcome.cycles } : { revisions: 0, replans: 0 },
    resultCount,
    updatedAt: now,
  };
}

function reviewerEvidence(results) {
  const reviewer = results.find(
    (entry) => entry?.role === "REVIEWER" && entry?.status === "COMPLETED",
  );
  const parts = [];
  if (nonEmptyString(reviewer?.summary)) parts.push(`reviewer: ${reviewer.summary}`);
  for (const item of asArray(reviewer?.evidence)) {
    parts.push(`reviewer-evidence: ${typeof item === "string" ? item : JSON.stringify(item)}`);
  }
  for (const artifact of asArray(reviewer?.artifacts)) {
    parts.push(`artifact: ${typeof artifact === "string" ? artifact : JSON.stringify(artifact)}`);
  }
  return parts.length > 0 ? parts.join("\n") : "agent-run: reviewer accepted";
}

function markAcceptedRequirementsVerified(requirements, results, now) {
  if (!Array.isArray(requirements) || requirements.length === 0) return requirements;
  const evidence = reviewerEvidence(results);
  return requirements.map((requirement) => {
    if (!isObject(requirement)) return requirement;
    if (requirement.status === "verified") return requirement;
    return {
      ...requirement,
      status: "verified",
      evidence: [...asArray(requirement.evidence), evidence],
      verifiedAt: now,
      updatedAt: now,
    };
  });
}

export function applyAgentRun(task, outcome, { now = Date.now(), maxHistory = 5 } = {}) {
  if (!isObject(task)) {
    throw new AgentTaskIntegrationError("task snapshot is required");
  }
  if (!isObject(outcome)) {
    throw new AgentTaskIntegrationError("agent outcome is required");
  }
  if (!Number.isInteger(maxHistory) || maxHistory < 0) {
    throw new AgentTaskIntegrationError("maxHistory must be a non-negative integer");
  }
  const results = asArray(outcome.results).map(summarizeResult);
  const accepted =
    outcome.status === "COMPLETED" &&
    outcome.verdict === "ACCEPTED" &&
    task.executionIntent !== "ANALYZE";
  const requirements = accepted
    ? markAcceptedRequirementsVerified(task.requirements, results, now)
    : task.requirements;
  const previousRun = isObject(task.agentRun) ? task.agentRun : null;
  const failed = outcome.status === "FAILED" || outcome.stoppedAt === "agent";
  const previousStreak = Number.isInteger(previousRun?.failureStreak)
    ? previousRun.failureStreak
    : 0;
  const agentRun = {
    status: outcome.status ?? null,
    verdict: outcome.verdict ?? null,
    stoppedAt: outcome.stoppedAt ?? null,
    exhausted: outcome.exhausted === true,
    surfaced: carriesSurfaced(previousRun, outcome),
    failureStreak: failed ? previousStreak + 1 : 0,
    cycles: isObject(outcome.cycles) ? { ...outcome.cycles } : { revisions: 0, replans: 0 },
    results,
    handoffs: asArray(outcome.handoffs).map((handoff) =>
      isObject(handoff) ? { ...handoff } : handoff,
    ),
    updatedAt: now,
  };
  const previousHistory = asArray(task.agentHistory);
  const nextHistory = [...previousHistory, summaryEntry(outcome, results.length, now)];
  const agentHistory = maxHistory === 0 ? [] : nextHistory.slice(-maxHistory);
  return {
    ...task,
    agentRun,
    agentHistory,
    ...(accepted ? { requirements } : {}),
  };
}

function describeError(error) {
  if (!isObject(error)) return { message: String(error), code: "", status: null };
  const data = isObject(error.data) ? error.data : null;
  const dataError = isObject(data?.error) ? data.error : null;
  const message =
    (nonEmptyString(dataError?.message) && dataError.message) ||
    (nonEmptyString(data?.message) && data.message) ||
    (nonEmptyString(error.message) && error.message) ||
    (nonEmptyString(error.name) && error.name) ||
    String(error);
  const code =
    (nonEmptyString(error.code) && error.code) ||
    (nonEmptyString(data?.code) && data.code) ||
    (nonEmptyString(dataError?.code) && dataError.code) ||
    "";
  const status = data?.statusCode ?? error.status ?? data?.status ?? null;
  return { message, code, status };
}

export function formatAgentFailure(error, { maxLength = 300 } = {}) {
  if (!isObject(error)) return String(error || "agent step failed").slice(0, maxLength);
  const top = describeError(error);
  const parts = [top.message];
  if (top.code) parts.push(`code=${top.code}`);
  if (top.status !== null) parts.push(`status=${top.status}`);
  let cause = error.cause;
  for (let depth = 0; cause && depth < 3; depth += 1) {
    const detail = describeError(cause);
    const suffix = `${detail.code ? ` code=${detail.code}` : ""}${detail.status !== null ? ` status=${detail.status}` : ""}`;
    parts.push(`cause${depth === 0 ? "" : `[${depth}]`}: ${detail.message}${suffix}`);
    cause = isObject(cause) ? cause.cause : undefined;
  }
  const text = parts.join("; ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

const RETRYABLE_AGENT_ERROR_CODES = new Set([
  "PROMPT_TIMEOUT",
  "PROMPT_FAILED",
  "SESSION_CREATE_FAILED",
]);
const TERMINAL_AGENT_STATUSES = new Set(["BLOCKED", "NEEDS_INPUT", "FAILED", "COMPLETED"]);

function isAbortTimeoutBusy(error) {
  const seen = new Set();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if (
      cause.name === "AbortError" ||
      cause.name === "TimeoutError" ||
      cause.code === "ABORT_ERR" ||
      cause.code === "ETIMEDOUT"
    ) {
      return true;
    }
    const status = Number(
      cause.status ?? cause.statusCode ?? cause.httpStatus ?? cause.data?.status,
    );
    if (status === 408 || status === 429 || (status >= 500 && status <= 599)) return true;
    const message = typeof cause.message === "string" ? cause.message : "";
    if (/timeout|timed out|aborted|abort|busy|rate.?limit|too many requests|temporar|overload/i.test(message)) {
      return true;
    }
    cause = cause.cause;
  }
  return false;
}

export function isRetryableAgentError(error) {
  if (!isObject(error)) return false;
  const code = nonEmptyString(error.code) ? error.code : "";
  if (code === "INVALID_RESULT" || /CONTRACT/i.test(code)) return false;
  if (TERMINAL_AGENT_STATUSES.has(error.status) || TERMINAL_AGENT_STATUSES.has(error.roleStatus)) {
    return false;
  }
  if (RETRYABLE_AGENT_ERROR_CODES.has(code)) return true;
  if (code === "ORCHESTRATION_TIMEOUT" || code === "AGENT_TIMEOUT") return true;
  return isAbortTimeoutBusy(error);
}

export function applyAgentFailure(
  task,
  message,
  { failureCode, attempts, now = Date.now(), maxHistory = 5 } = {},
) {
  const updated = applyAgentRun(
    task,
    {
      status: "FAILED",
      verdict: null,
      stoppedAt: "agent",
      exhausted: false,
      ...(failureCode !== undefined ? { failureCode } : {}),
      results: [],
      handoffs: [],
      cycles: task?.agentRun?.cycles,
    },
    { now, maxHistory },
  );
  updated.agentRun.failureReason = String(message || "agent step failed");
  if (failureCode !== undefined) updated.agentRun.failureCode = failureCode;
  if (attempts !== undefined) updated.agentRun.attempts = attempts;
  return updated;
}

export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;

export function shouldRunTaskAgentPass(task, { maxConsecutiveFailures } = {}) {
  if (!isObject(task)) return false;
  const agentRun = task.agentRun;
  if (!isObject(agentRun)) return true;
  if (agentRun.exhausted === true) return false;
  if (agentRun.status === "COMPLETED" && agentRun.verdict === "ACCEPTED") {
    return false;
  }
  const budget = Number.isInteger(maxConsecutiveFailures) && maxConsecutiveFailures > 0
    ? maxConsecutiveFailures
    : DEFAULT_MAX_CONSECUTIVE_FAILURES;
  const streak = Number.isInteger(agentRun.failureStreak) ? agentRun.failureStreak : 0;
  if (streak >= budget) return false;
  return !["BLOCKED", "NEEDS_INPUT"].includes(agentRun.status);
}

export async function runConfiguredTaskAgentStep({
  task,
  taskId,
  adapter,
  config,
  contextSelector,
  now,
  persist,
} = {}) {
  const agentConfig = isObject(config) ? config : {};
  if (agentConfig.enabled !== true) return null;
  if (!shouldRunTaskAgentPass(task, { maxConsecutiveFailures: agentConfig.maxConsecutiveFailures })) {
    return null;
  }
  return runTaskAgentStep({
    task,
    taskId,
    adapter,
    contextSelector,
    maxRevisionCycles: agentConfig.maxRevisionCycles,
    maxReplanCycles: agentConfig.maxReplanCycles,
    maxAttempts: agentConfig.maxAttempts,
    maxHistory: agentConfig.maxHistory,
    now,
    persist,
  });
}

export async function runTaskAgentStep({
  task,
  taskId,
  adapter,
  contextSelector,
  maxChars,
  maxCharsPerSource,
  maxRevisionCycles,
  maxReplanCycles,
  maxAttempts = 1,
  now = Date.now(),
  maxHistory = 5,
  persist,
} = {}) {
  if (persist !== undefined && typeof persist !== "function") {
    throw new AgentTaskIntegrationError("persist must be a function when provided");
  }
  const hasIdentity = isObject(task) && (task.id || task.taskId || task.task_id);
  const snapshot = !hasIdentity && nonEmptyString(taskId) ? { ...task, id: taskId } : task;
  const input = buildTaskAgentInput(snapshot);
  const baseConstraints = Array.isArray(input.constraints) ? input.constraints : [];
  const totalAttempts =
    Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 1;
  let constraints = baseConstraints;
  let attemptMaxChars = maxChars;
  let attempts = 0;
  let lastError;
  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    attempts = attempt + 1;
    try {
      const outcome = await runAgentFeedbackOrchestration({
        ...input,
        adapter,
        contextSelector,
        constraints,
        maxChars: attemptMaxChars,
        maxCharsPerSource,
        maxRevisionCycles,
        maxReplanCycles,
      });
      const updatedTask = applyAgentRun(task, outcome, { now, maxHistory });
      if (persist) {
        await persist(updatedTask, outcome);
      }
      return {
        task: updatedTask,
        outcome,
        decision: decideAgentLoopAction(outcome),
        attempts,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableAgentError(error) || attempts >= totalAttempts) break;
      const code = nonEmptyString(error?.code) ? error.code : "AGENT_FAILURE";
      constraints = [
        ...baseConstraints,
        `Retry ${attempts}: previous attempt failed with ${code}; return a minimal evidence-backed result and stop exploring.`,
      ];
      if (typeof attemptMaxChars === "number" && attemptMaxChars > 0) {
        attemptMaxChars = Math.max(2000, Math.floor(attemptMaxChars * 0.6));
      }
    }
  }
  if (lastError && typeof lastError === "object") {
    lastError.attempts = attempts;
    if (nonEmptyString(lastError.code)) lastError.failureCode = lastError.code;
  }
  throw lastError;
}
