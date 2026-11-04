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
    const detail =
      typeof agent.failureReason === "string" ? agent.failureReason.trim().replace(/\s+/g, " ") : "";
    return {
      decision: "BLOCK",
      reason: detail ? `agent-failed: ${detail.slice(0, 200)}` : "agent-failed",
    };
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
  if (status === "REVISION_REQUIRED") {
    return { decision: "CONTINUE", reason: "agent-revision-required" };
  }
  if (status === "REPLAN_REQUIRED") {
    return { decision: "REPLAN", reason: "agent-replan-required" };
  }
  if (status === "COMPLETED" && verdict === "ACCEPTED") {
    return { decision: "VERIFY", reason: "agent-review-accepted" };
  }
  return null;
}

/**
 * Agent outcomes that must be resolved before quality, completion-gate, budget
 * and iteration decisions: hard stops (BLOCK/WAIT_USER) plus reviewer
 * rejections (CONTINUE/REPLAN). An ACCEPTED review maps to VERIFY and stays
 * after the completion gate, which remains authoritative when satisfied.
 */
const AGENT_PRE_GATE_DECISIONS = new Set(["BLOCK", "WAIT_USER", "CONTINUE", "REPLAN"]);

function isAgentPreGateAction(action) {
  return Boolean(action) && AGENT_PRE_GATE_DECISIONS.has(action.decision);
}

const CHECKPOINT_STATUS = {
  COMPLETE: "COMPLETED",
  STOP_BUDGET: "STOPPED",
  STOP_STAGNATION: "STOPPED",
  WAIT_AUTHORIZATION: "WAITING_AUTHORIZATION",
  WAIT_USER: "WAITING_USER",
  BLOCK: "BLOCKED",
};

function latestReviewFindings(agent) {
  const results = Array.isArray(agent?.results) ? agent.results : [];
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result?.role !== "REVIEWER") continue;
    const payload = result?.result && typeof result.result === "object" ? result.result : result;
    const findings = Array.isArray(payload.findings) ? payload.findings : [];
    return findings
      .map((finding) => {
        if (typeof finding === "string") return finding.trim() || null;
        if (!finding || typeof finding !== "object") return null;
        const label = finding.id ? `${finding.id}: ` : "";
        const text =
          finding.summary || finding.description || finding.message || finding.title || "";
        return `${label}${text}`.trim() || null;
      })
      .filter(Boolean);
  }
  return [];
}

function buildNextAction(decision, reason, pending, authorization, agent) {
  switch (decision) {
    case "CONTINUE":
      return { type: "continue", reason };
    case "REPLAN":
      return { type: "replan", reason };
    case "VERIFY":
      return { type: "verify", pending: [...pending] };
    case "WAIT_USER":
      return {
        type: "wait_user",
        reason,
        pending: [...pending],
        findings: latestReviewFindings(agent),
      };
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
    completionGate.allDone === true ||
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
  } else if (authorization.pendingAuth && authorization.contractApproved !== true) {
    decision = "WAIT_AUTHORIZATION";
    reason = "authorization-pending";
  } else if (authorization.contractApproved === false) {
    decision = "WAIT_USER";
    reason = "contract-not-approved";
  } else if (taskState === "BLOCKED" || task.blocked) {
    decision = "BLOCK";
    reason = "task-blocked";
  } else if (isAgentPreGateAction(agentAction)) {
    decision = agentAction.decision;
    reason = agentAction.reason;
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
  // STOP_STAGNATION is intentionally evaluated before the work VERIFY branch so a
  // non-advancing loop cannot keep verifying forever; quality VERIFY above it is
  // separate and still runs when evidence is insufficient.
  } else if (nextNoProgress >= (loop.maxNoProgress ?? 3) && !progress.advanced) {
    decision = "STOP_STAGNATION";
    reason = "no-progress";
    stopReason = "no-progress";
  } else if (effectivePending.length > 0 && (taskState === "VERIFYING" || completionGate.requiresVerification === true)) {
    decision = "VERIFY";
    reason = "verification-required";
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
    nextAction: buildNextAction(decision, reason, effectivePending, authorization, agent),
    checkpoint,
    stopReason,
  };
}

export function buildTaskLoopPrompt(result = {}) {
  const decision = result.decision || "CONTINUE";
  const lines = [`WAM task loop: ${decision} (${result.reason || "work-remaining"})`];
  const next = result.nextAction || {};
  if (next.type === "wait_user") {
    if (Array.isArray(next.findings) && next.findings.length > 0) {
      lines.push("Reviewer findings:");
      for (const item of next.findings) lines.push(`- ${item}`);
    }
    if (Array.isArray(next.pending) && next.pending.length > 0) {
      lines.push("Pending verification:");
      for (const item of next.pending) lines.push(`- ${item}`);
    }
    lines.push(
      "Next: reply with the missing decision, evidence, or fix so the agent pass can resume.",
    );
  } else if (next.type === "verify" && Array.isArray(next.pending) && next.pending.length > 0) {
    lines.push("Pending verification:");
    for (const item of next.pending) lines.push(`- ${item}`);
  } else if (next.type === "wait_authorization") {
    lines.push(`Authorization pending: ${next.id || "unknown"}`);
    lines.push("Next: approve or deny the pending permission to continue.");
  } else if (next.type === "block") {
    lines.push(`Blocked: ${next.reason || result.reason || "unknown"}`);
    lines.push("Next: resolve the block or reply with new instructions.");
  } else if (next.type === "stop") {
    lines.push(`Stopped: ${next.reason || result.stopReason || "unknown"}`);
    lines.push("Next: reply with a concrete change or resume command to continue.");
  } else if (next.type) {
    lines.push(`Next: ${next.type}`);
  }
  if (result.stopReason) lines.push(`Stop: ${result.stopReason}`);
  return { parts: [{ type: "text", text: lines.join("\n"), synthetic: true }] };
}
