import test from "node:test";
import assert from "node:assert/strict";
import { decideNextAction, buildTaskLoopPrompt, TASK_LOOP_DECISIONS } from "./task-loop.js";
import { isWamSynthetic } from "../integration/part-provenance.js";
import { extractPrompt } from "../integration/message-handler.js";

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

  const allDone = decideNextAction({
    task: { state: "EXECUTING" },
    completionGate: { blocked: false, allDone: true, completionIntent: false },
  });
  assert.equal(allDone.decision, "COMPLETE");
  assert.equal(allDone.reason, "evidence-complete");

  const accepted = decideNextAction({
    task: { state: "EXECUTING" },
    loop: { iteration: 3 },
    completionGate: { blocked: false, allDone: true, completionIntent: false },
    agent: { status: "COMPLETED", verdict: "ACCEPTED" },
  });
  assert.equal(accepted.decision, "COMPLETE");
  assert.equal(accepted.reason, "evidence-complete");

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
  assert.equal(result.nextAction.type, "complete");
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

  const approved = decideNextAction({
    task: { state: "EXECUTING", contract: { status: "APPROVED" } },
    authorization: { contractApproved: true },
    completionGate: { pending: ["req-1"] },
  });
  assert.equal(approved.decision, "CONTINUE");
  assert.equal(approved.reason, "work-remaining");

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

test("no-progress wins over pending verification", () => {
  const result = decideNextAction({
    task: { state: "VERIFYING" },
    loop: { iteration: 4, consecutiveNoProgress: 3, maxNoProgress: 3 },
    completionGate: { pending: ["req-1"], requiresVerification: true },
  });
  assert.equal(result.decision, "STOP_STAGNATION");
  assert.equal(result.reason, "no-progress");
  assert.equal(result.stopReason, "no-progress");
  assert.equal(result.checkpoint.status, "STOPPED");
});

test("progress with pending verification verifies instead of stopping", () => {
  const result = decideNextAction({
    task: { state: "VERIFYING" },
    loop: { iteration: 5, consecutiveNoProgress: 3, maxNoProgress: 3 },
    progress: { advanced: true },
    completionGate: { pending: ["req-1"], requiresVerification: true },
  });
  assert.notEqual(result.decision, "STOP_STAGNATION");
  assert.equal(result.decision, "VERIFY");
  assert.equal(result.reason, "verification-required");
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
  assert.equal(isWamSynthetic(payload.parts[0]), true);
  assert.match(payload.parts[0].text, /VERIFY/);
  assert.match(payload.parts[0].text, /verification-required/);
  assert.match(payload.parts[0].text, /req-1/);
  assert.ok(TASK_LOOP_DECISIONS.includes("CONTINUE"));
  assert.equal(TASK_LOOP_DECISIONS.length, 9);
});

test("task loop prompts are not re-consumed as user input", () => {
  const payload = buildTaskLoopPrompt({
    decision: "WAIT_USER",
    reason: "agent-failed",
  });
  assert.equal(extractPrompt({}, payload), "");
  assert.equal(
    extractPrompt({ message: { parts: payload.parts } }, {}),
    "",
  );
});

test("buildTaskLoopPrompt explains authorization and block next steps", () => {
  const auth = buildTaskLoopPrompt({
    decision: "WAIT_AUTHORIZATION",
    reason: "authorization-pending",
    nextAction: { type: "wait_authorization", id: "auth-1" },
  });
  assert.match(auth.parts[0].text, /Authorization pending: auth-1/);
  assert.match(auth.parts[0].text, /approve or deny/);

  const block = buildTaskLoopPrompt({
    decision: "BLOCK",
    reason: "agent-failed",
    nextAction: { type: "block", reason: "agent-failed" },
  });
  assert.match(block.parts[0].text, /Blocked: agent-failed/);
  assert.match(block.parts[0].text, /resolve the block/);

  const stop = buildTaskLoopPrompt({
    decision: "STOP_BUDGET",
    reason: "budget-exhausted",
    nextAction: { type: "stop", reason: "budget-exhausted" },
    stopReason: "budget-exhausted",
  });
  assert.match(stop.parts[0].text, /Stopped: budget-exhausted/);
  assert.match(stop.parts[0].text, /new evidence or correction/);
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

test("exhausted WAIT_USER carries the reviewer findings and pending items", () => {
  const result = decideNextAction({
    task: { state: "EXECUTING" },
    completionGate: { ok: false, pending: ["req-1"] },
    agent: {
      status: "COMPLETED",
      verdict: "REVISION_REQUIRED",
      exhausted: true,
      results: [
        {
          role: "REVIEWER",
          findings: [{ id: "F-R1", summary: "The replacement link uses the Sin categoría sentinel" }],
        },
      ],
    },
  });

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-revision-exhausted");
  assert.deepEqual(result.nextAction.pending, ["req-1"]);
  assert.deepEqual(result.nextAction.findings, [
    "F-R1: The replacement link uses the Sin categoría sentinel",
  ]);

  const payload = buildTaskLoopPrompt(result);
  assert.match(payload.parts[0].text, /Reviewer findings/);
  assert.match(payload.parts[0].text, /F-R1/);
  assert.match(payload.parts[0].text, /req-1/);

  const fresh = decideNextAction({
    task: { state: "EXECUTING" },
    agent: {
      status: "COMPLETED",
      verdict: "REVISION_REQUIRED",
      exhausted: true,
      results: [
        { role: "REVIEWER", result: { findings: [{ id: "F-R2", description: "nested shape" }] } },
      ],
    },
  });
  assert.deepEqual(fresh.nextAction.findings, ["F-R2: nested shape"]);
});
