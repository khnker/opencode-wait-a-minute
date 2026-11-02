import test from "node:test";
import assert from "node:assert/strict";
import { decideNextAction, buildTaskLoopPrompt, TASK_LOOP_DECISIONS } from "./task-loop.js";

test("CONTINUE with pending gate while executing increments iteration", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 2, maxIterations: 10 },
    completionGate: { pending: ["req-1"] },
  });
  assert.equal(result.decision, "CONTINUE");
  assert.equal(result.reason, "work-remaining");
  assert.equal(result.nextAction.type, "continue");
  assert.equal(result.stopReason, null);
  assert.deepEqual(result.checkpoint, {
    status: "RUNNING",
    iteration: 3,
    consecutiveNoProgress: 1,
    lastProgressFingerprint: null,
  });
});

test("COMPLETE only when the gate has no pending work", () => {
  const bare = decideNextAction({ task: { state: "EXECUTING" }, completionGate: {} });
  assert.equal(bare.decision, "CONTINUE");

  const empty = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 4 },
    completionGate: { pending: [] },
  });
  assert.equal(empty.decision, "COMPLETE");
  assert.equal(empty.reason, "evidence-complete");
  assert.equal(empty.nextAction.type, "complete");
  assert.equal(empty.stopReason, null);
  assert.equal(empty.checkpoint.iteration, 4);

  const explicit = decideNextAction({ task: { state: "EXECUTING" }, completionGate: { ok: true } });
  assert.equal(explicit.decision, "COMPLETE");

  const rejected = decideNextAction({ task: { state: "EXECUTING" }, completionGate: { ok: false, pending: [] } });
  assert.equal(rejected.decision, "CONTINUE");
});

test("COMPLETED task stops without new work", () => {
  const result = decideNextAction({
    task: { state: "COMPLETED" },
    loop: { iteration: 5 },
    completionGate: { pending: ["req-1"] },
  });
  assert.equal(result.decision, "COMPLETE");
  assert.equal(result.reason, "already-completed");
  assert.equal(result.stopReason, "already-completed");
  assert.equal(result.checkpoint.status, "COMPLETED");
  assert.equal(result.checkpoint.iteration, 5);
});

test("STOPPED loop yields STOP_STAGNATION", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { status: "STOPPED", stopReason: "manual", iteration: 2, consecutiveNoProgress: 1 },
  });
  assert.equal(result.decision, "STOP_STAGNATION");
  assert.equal(result.reason, "manual");
  assert.equal(result.nextAction.type, "stop");
  assert.equal(result.stopReason, "manual");
  assert.deepEqual(result.checkpoint, {
    status: "STOPPED",
    iteration: 2,
    consecutiveNoProgress: 1,
    lastProgressFingerprint: null,
  });
});

test("authorization and blocked states win over execution", () => {
  const pendingAuth = decideNextAction({
    task: { state: "EXECUTING" },
    authorization: { pendingAuth: { id: "auth-1" } },
  });
  assert.equal(pendingAuth.decision, "WAIT_AUTHORIZATION");
  assert.deepEqual(pendingAuth.nextAction, { type: "wait_authorization", id: "auth-1" });
  assert.equal(pendingAuth.checkpoint.status, "WAITING_AUTHORIZATION");

  const denied = decideNextAction({ task: { state: "EXECUTING" }, authorization: { denied: true } });
  assert.equal(denied.decision, "BLOCK");
  assert.equal(denied.reason, "authorization-denied");

  const unapproved = decideNextAction({ task: { state: "EXECUTING" }, authorization: { contractApproved: false } });
  assert.equal(unapproved.decision, "WAIT_USER");
  assert.equal(unapproved.reason, "contract-not-approved");
  assert.equal(unapproved.checkpoint.status, "WAITING_USER");

  const blocked = decideNextAction({ task: { state: "EXECUTING", blocked: true } });
  assert.equal(blocked.decision, "BLOCK");
  assert.equal(blocked.reason, "task-blocked");
  assert.equal(blocked.checkpoint.status, "BLOCKED");
});

test("budget and iteration limits stop the loop", () => {
  const budget = decideNextAction({ task: { state: "EXECUTING" }, budget: { exhausted: true } });
  assert.equal(budget.decision, "STOP_BUDGET");
  assert.equal(budget.reason, "budget-exhausted");
  assert.equal(budget.stopReason, "budget-exhausted");
  assert.equal(budget.checkpoint.status, "STOPPED");

  const limit = decideNextAction({ task: { state: "EXECUTING" }, loop: { iteration: 10, maxIterations: 10 } });
  assert.equal(limit.decision, "STOP_BUDGET");
  assert.equal(limit.reason, "iteration-limit");
  assert.equal(limit.stopReason, "iteration-limit");
});

test("regression signals replan the strategy", () => {
  const regressed = decideNextAction({ task: { state: "EXECUTING" }, progress: { regressed: true } });
  assert.equal(regressed.decision, "REPLAN");
  assert.equal(regressed.reason, "strategy-regressed");
  assert.equal(regressed.nextAction.type, "replan");
  assert.equal(regressed.checkpoint.iteration, 1);

  const repeated = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 3 },
    progress: { repeatedRejectedHypothesis: true },
  });
  assert.equal(repeated.decision, "REPLAN");
  assert.equal(repeated.checkpoint.iteration, 4);
});

test("VERIFYING with pending work requires verification", () => {
  const result = decideNextAction({
    task: { state: "VERIFYING" },
    loop: { iteration: 1 },
    completionGate: { pending: ["req-1", "req-2"] },
  });
  assert.equal(result.decision, "VERIFY");
  assert.equal(result.reason, "verification-required");
  assert.deepEqual(result.nextAction, { type: "verify", pending: ["req-1", "req-2"] });
  assert.equal(result.checkpoint.iteration, 2);
  assert.equal(result.checkpoint.status, "RUNNING");
});

test("no-progress streak stops the loop and progress resets it", () => {
  const stopped = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 2, consecutiveNoProgress: 2, maxNoProgress: 3 },
  });
  assert.equal(stopped.decision, "STOP_STAGNATION");
  assert.equal(stopped.reason, "no-progress");
  assert.equal(stopped.stopReason, "no-progress");
  assert.equal(stopped.checkpoint.status, "STOPPED");

  const advanced = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 2, consecutiveNoProgress: 2, maxNoProgress: 3 },
    progress: { advanced: true, fingerprint: "EXECUTING:1/2:1" },
  });
  assert.equal(advanced.decision, "CONTINUE");
  assert.equal(advanced.checkpoint.consecutiveNoProgress, 0);
  assert.equal(advanced.checkpoint.lastProgressFingerprint, "EXECUTING:1/2:1");
});

test("missing task throws TypeError", () => {
  assert.throws(() => decideNextAction({}), { name: "TypeError", message: "task-loop: task snapshot required" });
});

test("buildTaskLoopPrompt returns a synthetic text part", () => {
  const payload = buildTaskLoopPrompt({
    decision: "VERIFY",
    reason: "verification-required",
    nextAction: { type: "verify", pending: ["req-1", "req-2"] },
    stopReason: null,
  });
  assert.equal(payload.parts.length, 1);
  assert.equal(payload.parts[0].type, "text");
  assert.equal(payload.parts[0].synthetic, true);
  assert.match(payload.parts[0].text, /VERIFY/);
  assert.match(payload.parts[0].text, /verification-required/);
  assert.match(payload.parts[0].text, /req-1/);
  assert.ok(TASK_LOOP_DECISIONS.includes("CONTINUE"));
  assert.equal(TASK_LOOP_DECISIONS.length, 9);
});

test("quality contradictions replan even when the gate looks complete", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    completionGate: { ok: true, pending: [] },
    quality: { enabled: true, sufficient: false, contradictions: [{ reason: "failed-evidence" }], reasons: ["contradiction:r1:failed-evidence"] },
  });
  assert.equal(result.decision, "REPLAN");
  assert.equal(result.reason, "quality-contradiction");
});

test("insufficient quality evidence forces verification with reasons", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    completionGate: { ok: true, pending: [] },
    quality: { enabled: true, sufficient: false, contradictions: [], reasons: ["missing:r1:missing-evidence:TEST_RESULT"] },
  });
  assert.equal(result.decision, "VERIFY");
  assert.equal(result.reason, "quality-insufficient");
  assert.deepEqual(result.nextAction.pending, ["missing:r1:missing-evidence:TEST_RESULT"]);
});

test("disabled quality evaluation leaves existing decisions untouched", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    completionGate: { ok: true, pending: [] },
    quality: { enabled: false, sufficient: false, contradictions: [], reasons: ["missing:r1"] },
  });
  assert.equal(result.decision, "COMPLETE");
  assert.equal(result.reason, "evidence-complete");
});
