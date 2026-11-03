import test from "node:test";
import assert from "node:assert/strict";

import {
  decideAgentLoopAction,
  decideNextAction,
} from "../../src/execution/task-loop.js";

const SATISFIED_GATE = { ok: true, pending: [] };
const OPEN_GATE = { ok: false, pending: ["AC1"] };

function loopInput(agent, overrides = {}) {
  return {
    task: { state: "EXECUTING" },
    completionGate: SATISFIED_GATE,
    agent,
    ...overrides,
  };
}

test("FAILED agent outranks a satisfied completion gate", () => {
  const result = decideNextAction(loopInput({ status: "FAILED" }));

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "agent-failed");
  assert.deepEqual(result.nextAction, { type: "block", reason: "agent-failed" });
  assert.equal(result.checkpoint.status, "BLOCKED");
});

test("BLOCKED agent outranks a satisfied completion gate", () => {
  const result = decideNextAction(loopInput({ status: "BLOCKED" }));

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-blocked");
  assert.deepEqual(result.nextAction, { type: "wait_user" });
  assert.equal(result.checkpoint.status, "WAITING_USER");
});

test("NEEDS_INPUT agent outranks a satisfied completion gate", () => {
  const result = decideNextAction(loopInput({ status: "NEEDS_INPUT" }));

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-needs-input");
  assert.deepEqual(result.nextAction, { type: "wait_user" });
});

test("exhausted revision cycle outranks a satisfied completion gate", () => {
  const result = decideNextAction(
    loopInput({ status: "REVISION_REQUIRED", verdict: "REVISION_REQUIRED", exhausted: true }),
  );

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-revision-exhausted");
  assert.equal(result.checkpoint.status, "WAITING_USER");
});

test("exhausted replan cycle outranks a satisfied completion gate", () => {
  const result = decideNextAction(
    loopInput({ status: "REPLAN_REQUIRED", verdict: "REPLAN_REQUIRED", exhausted: true }),
  );

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-replan-exhausted");
});

test("hard agent stop outranks exhausted budget", () => {
  const result = decideNextAction(loopInput({ status: "FAILED" }, { budget: { exhausted: true } }));

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "agent-failed");
});

test("hard agent stop outranks the iteration limit", () => {
  const result = decideNextAction(
    loopInput({ status: "BLOCKED" }, { loop: { iteration: 3, maxIterations: 3 } }),
  );

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "agent-blocked");
});

test("hard agent stop outranks quality findings", () => {
  const result = decideNextAction(
    loopInput(
      { status: "FAILED" },
      { quality: { enabled: true, sufficient: false, contradictions: ["conflict"] } },
    ),
  );

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "agent-failed");
});

test("reviewer rejection outranks a satisfied completion gate", () => {
  const revision = decideNextAction(loopInput({ status: "REVISION_REQUIRED" }));
  assert.equal(revision.decision, "CONTINUE");
  assert.equal(revision.reason, "agent-revision-required");
  assert.deepEqual(revision.nextAction, { type: "continue", reason: "agent-revision-required" });

  const replan = decideNextAction(loopInput({ status: "REPLAN_REQUIRED" }));
  assert.equal(replan.decision, "REPLAN");
  assert.equal(replan.reason, "agent-replan-required");
  assert.deepEqual(replan.nextAction, { type: "replan", reason: "agent-replan-required" });
});

test("accepted review still defers to a satisfied completion gate", () => {
  const result = decideNextAction(
    loopInput({ status: "COMPLETED", verdict: "ACCEPTED" }),
  );

  assert.equal(result.decision, "COMPLETE");
  assert.equal(result.reason, "evidence-complete");
  assert.deepEqual(result.nextAction, { type: "complete" });
  assert.equal(result.checkpoint.status, "COMPLETED");
  assert.equal(result.stopReason, null);
});

test("accepted review defers to an unsatisfied completion gate", () => {
  const result = decideNextAction(
    loopInput(
      { status: "COMPLETED", verdict: "ACCEPTED" },
      { completionGate: OPEN_GATE },
    ),
  );

  assert.equal(result.decision, "VERIFY");
  assert.equal(result.reason, "agent-review-accepted");
  assert.deepEqual(result.nextAction, { type: "verify", pending: ["AC1"] });
});

test("no agent with a satisfied gate still completes", () => {
  const result = decideNextAction(loopInput(null));

  assert.equal(result.decision, "COMPLETE");
  assert.equal(result.reason, "evidence-complete");
  assert.deepEqual(result.nextAction, { type: "complete" });
});

test("exhausted budget still wins over an accepted review", () => {
  const result = decideNextAction(
    loopInput(
      { status: "COMPLETED", verdict: "ACCEPTED" },
      { completionGate: OPEN_GATE, budget: { exhausted: true } },
    ),
  );

  assert.equal(result.decision, "STOP_BUDGET");
  assert.equal(result.reason, "budget-exhausted");
  assert.equal(result.stopReason, "budget-exhausted");
  assert.deepEqual(result.nextAction, { type: "stop", reason: "budget-exhausted" });
});

test("authorization denial keeps priority over hard agent stops", () => {
  const result = decideNextAction(
    loopInput({ status: "FAILED" }, { authorization: { denied: true } }),
  );

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "authorization-denied");
});

test("pending authorization keeps priority over hard agent stops", () => {
  const result = decideNextAction(
    loopInput(
      { status: "FAILED" },
      { authorization: { pendingAuth: { id: "auth-1" } } },
    ),
  );

  assert.equal(result.decision, "WAIT_AUTHORIZATION");
  assert.equal(result.reason, "authorization-pending");
  assert.deepEqual(result.nextAction, { type: "wait_authorization", id: "auth-1" });
});

test("unapproved contract keeps priority over hard agent stops", () => {
  const result = decideNextAction(
    loopInput({ status: "FAILED" }, { authorization: { contractApproved: false } }),
  );

  assert.equal(result.decision, "WAIT_USER");
  assert.equal(result.reason, "contract-not-approved");
});

test("task-blocked keeps priority over hard agent stops", () => {
  const result = decideNextAction(
    loopInput({ status: "FAILED" }, { task: { state: "BLOCKED" } }),
  );

  assert.equal(result.decision, "BLOCK");
  assert.equal(result.reason, "task-blocked");
});

test("decideAgentLoopAction exposes reviewer rejection without changing exhausted behavior", () => {
  assert.deepEqual(decideAgentLoopAction({ status: "REVISION_REQUIRED" }), {
    decision: "CONTINUE",
    reason: "agent-revision-required",
  });
  assert.deepEqual(decideAgentLoopAction({ status: "REPLAN_REQUIRED" }), {
    decision: "REPLAN",
    reason: "agent-replan-required",
  });
  assert.deepEqual(
    decideAgentLoopAction({ status: "REVISION_REQUIRED", verdict: "REVISION_REQUIRED", exhausted: true }),
    { decision: "WAIT_USER", reason: "agent-revision-exhausted" },
  );
});
