/** Task loop — pure, deterministic controller for execution-loop decisions. */
import { migrateLegacyPhase } from "./execution-state.js";

export const TASK_LOOP_DECISIONS = Object.freeze([
  "CONTINUE",
  "REPLAN",
  "VERIFY",
  "WAIT_USER",
  "WAIT_AUTHORIZATION",
  "BLOCK",
  "COMPLETE",
  "STOP_BUDGET",
  "STOP_STAGNATION",
]);

const ACTIONABLE = new Set(["CONTINUE", "REPLAN", "VERIFY"]);

export function decideAgentLoopAction(agent) {
  if (!agent || typeof agent !== "object") return null;
  const status = agent.status;
  const verdict = agent.verdict ?? null;
  if (status === "FAILED") {
    return { decision: "BLOCK", reason: "agent-failed" };
  }
  if (status === "BLOCKED") {
    return { decision: "WAIT_USER", reason: "agent-blocked" };
  }
  if (status === "NEEDS_INPUT") {
    return { decision: "WAIT_USER", reason: "agent-needs-input" };
  }
  if (agent.exhausted === true) {
    return {
      decision: "WAIT_USER",
      reason: verdict === "REPLAN_REQUIRED" ? "agent-replan-exhausted" : "agent-revision-exhausted",
    };
  }
  if (status === "COMPLETED" && verdict === "ACCEPTED") {
    return { decision: "VERIFY", reason: "agent-review-accepted" };
  }
  return null;
}

const CHECKPOINT_STATUS = {
  COMPLETE: "COMPLETED",
  STOP_BUDGET: "STOPPED",
  STOP_STAGNATION: "STOPPED",
  WAIT_AUTHORIZATION: "WAITING_AUTHORIZATION",
  WAIT_USER: "WAITING_USER",
  BLOCK: "BLOCKED",
};

function buildNextAction(decision, reason, pending, authorization) {
  switch (decision) {
    case "CONTINUE":
      return { type: "continue", reason };
    case "REPLAN":
      return { type: "replan", reason };
    case "VERIFY":
      return { type: "verify", pending: [...pending] };
    case "WAIT_USER":
      return { type: "wait_user" };
    case "WAIT_AUTHORIZATION":
      return { type: "wait_authorization", id: authorization.pendingAuth?.id || null };
    case "BLOCK":
      return { type: "block", reason };
    case "COMPLETE":
      return { type: "complete" };
    default:
      return { type: "stop", reason };
  }
}

export function decideNextAction({
  task,
  loop = {},
  progress = {},
  completionGate = {},
  authorization = {},
  budget = {},
  quality = {},
  agent = null,
} = {}) {
  if (!task) throw new TypeError("task-loop: task snapshot required");

  const taskState = task.state || migrateLegacyPhase(task.phase) || "INITIALIZING";
  const pending = Array.isArray(completionGate.pending) ? completionGate.pending : [];
  const qualityReasons = quality.enabled === true && Array.isArray(quality.reasons) ? quality.reasons : [];
  const contradictions = quality.enabled === true && Array.isArray(quality.contradictions) ? quality.contradictions : [];
  const qualityReplans = quality.enabled === true && quality.sufficient === false && contradictions.length > 0;
  const qualityVerifies = quality.enabled === true && quality.sufficient === false && contradictions.length === 0;
  const effectivePending = [...pending, ...qualityReasons];
  const gateComplete =
    completionGate.ok === true ||
    (Array.isArray(completionGate.pending) &&
      completionGate.pending.length === 0 &&
      completionGate.ok !== false);

  const nextNoProgress = progress.advanced ? 0 : (loop.consecutiveNoProgress || 0) + 1;
  const agentAction = decideAgentLoopAction(agent);

  let decision;
  let reason;
  let stopReason = null;

  if (taskState === "COMPLETED" || loop.status === "COMPLETED") {
    decision = "COMPLETE";
    reason = "already-completed";
    stopReason = "already-completed";
  } else if (loop.status === "STOPPED") {
    decision = "STOP_STAGNATION";
    reason = loop.stopReason || "loop-stopped";
    stopReason = reason;
  } else if (authorization.denied === true) {
    decision = "BLOCK";
    reason = "authorization-denied";
  } else if (authorization.pendingAuth) {
    decision = "WAIT_AUTHORIZATION";
    reason = "authorization-pending";
  } else if (authorization.contractApproved === false) {
    decision = "WAIT_USER";
    reason = "contract-not-approved";
  } else if (taskState === "BLOCKED" || task.blocked) {
    decision = "BLOCK";
    reason = "task-blocked";
  } else if (qualityReplans) {
    decision = "REPLAN";
    reason = "quality-contradiction";
  } else if (qualityVerifies) {
    decision = "VERIFY";
    reason = "quality-insufficient";
  } else if (gateComplete) {
    decision = "COMPLETE";
    reason = "evidence-complete";
  } else if (budget.exhausted === true) {
    decision = "STOP_BUDGET";
    reason = "budget-exhausted";
    stopReason = "budget-exhausted";
  } else if ((loop.iteration || 0) >= (loop.maxIterations ?? Infinity)) {
    decision = "STOP_BUDGET";
    reason = "iteration-limit";
    stopReason = "iteration-limit";
  } else if (agentAction) {
    decision = agentAction.decision;
    reason = agentAction.reason;
  } else if (progress.regressed === true || progress.repeatedRejectedHypothesis === true) {
    decision = "REPLAN";
    reason = "strategy-regressed";
  } else if (effectivePending.length > 0 && (taskState === "VERIFYING" || completionGate.requiresVerification === true)) {
    decision = "VERIFY";
    reason = "verification-required";
  } else if (nextNoProgress >= (loop.maxNoProgress ?? 3) && !progress.advanced) {
    decision = "STOP_STAGNATION";
    reason = "no-progress";
    stopReason = "no-progress";
  } else {
    decision = "CONTINUE";
    reason = "work-remaining";
  }

  const actionable = ACTIONABLE.has(decision);
  const checkpoint = {
    status: CHECKPOINT_STATUS[decision] || "RUNNING",
    iteration: actionable ? (loop.iteration || 0) + 1 : (loop.iteration || 0),
    consecutiveNoProgress: actionable ? nextNoProgress : (loop.consecutiveNoProgress || 0),
    lastProgressFingerprint: progress.fingerprint ?? loop.lastProgressFingerprint ?? null,
  };

  return {
    decision,
    reason,
    nextAction: buildNextAction(decision, reason, effectivePending, authorization),
    checkpoint,
    stopReason,
  };
}

export function buildTaskLoopPrompt(result = {}) {
  const decision = result.decision || "CONTINUE";
  const lines = [`WAM task loop: ${decision} (${result.reason || "work-remaining"})`];
  const next = result.nextAction || {};
  if (next.type === "verify" && Array.isArray(next.pending) && next.pending.length > 0) {
    lines.push("Pending verification:");
    for (const item of next.pending) lines.push(`- ${item}`);
  } else if (next.type) {
    lines.push(`Next: ${next.type}`);
  }
  if (result.stopReason) lines.push(`Stop: ${result.stopReason}`);
  return { parts: [{ type: "text", text: lines.join("\n"), synthetic: true }] };
}
