import test from "node:test";
import assert from "node:assert/strict";
import {
  pendingSignature,
  isCompletionClaim,
  planAutoContinuation,
  DEFAULT_AUTO_LOOP_CAP,
} from "./auto-continuation.js";

const gate = (pending) => ({ blocked: pending.length > 0, pending });

test("signature: stable and order-sensitive", () => {
  assert.equal(pendingSignature({ pending: ["a", "b"] }), "a\nb");
  assert.equal(pendingSignature({ pending: [] }), "");
  assert.notEqual(pendingSignature({ pending: ["a", "b"] }), pendingSignature({ pending: ["b", "a"] }));
});

test("claim: detects DONE at the end of the message", () => {
  assert.equal(isCompletionClaim("Implementé todo. Listo."), true);
  assert.equal(isCompletionClaim("Tarea completa."), true);
  assert.equal(isCompletionClaim("Done."), true);
});

test("claim: ignores questions and incidental mentions", () => {
  assert.equal(isCompletionClaim("¿Ya está lista la tarea?"), false);
  assert.equal(isCompletionClaim("I updated the completed file and left it there"), false);
  assert.equal(isCompletionClaim(""), false);
  assert.equal(isCompletionClaim(null), false);
});

test("plan: gate open never continues", () => {
  const plan = planAutoContinuation({ state: {}, gate: { blocked: false }, assistantText: "DONE" });
  assert.equal(plan.continue, false);
  assert.equal(plan.reason, "gate-open");
});

test("plan: no claim never continues even when blocked", () => {
  const plan = planAutoContinuation({
    state: {},
    gate: gate(["req-1 pending"]),
    assistantText: "Necesito que decidas entre A y B",
  });
  assert.equal(plan.continue, false);
  assert.equal(plan.reason, "no-completion-claim");
});

test("plan: continues and records the attempt", () => {
  const plan = planAutoContinuation({
    state: {},
    gate: gate(["req-1 pending"]),
    assistantText: "Listo, terminado.",
    messageID: "msg-1",
  });
  assert.equal(plan.continue, true);
  assert.match(plan.prompt, /req-1 pending/);
  assert.equal(plan.nextAutoLoop.attempts, 1);
  assert.equal(plan.nextAutoLoop.total, 1);
  assert.equal(plan.nextAutoLoop.lastMessageID, "msg-1");
});

test("plan: does not fire twice for the same assistant message", () => {
  const plan = planAutoContinuation({
    state: { autoLoop: { signature: "req-1 pending", attempts: 1, total: 1, lastMessageID: "msg-1" } },
    gate: gate(["req-1 pending"]),
    assistantText: "DONE",
    messageID: "msg-1",
  });
  assert.equal(plan.continue, false);
  assert.equal(plan.reason, "already-triggered");
});

test("plan: caps a repeated pending set", () => {
  const plan = planAutoContinuation({
    state: { autoLoop: { signature: "req-1 pending", attempts: DEFAULT_AUTO_LOOP_CAP, total: DEFAULT_AUTO_LOOP_CAP } },
    gate: gate(["req-1 pending"]),
    assistantText: "DONE",
    messageID: "msg-2",
  });
  assert.equal(plan.continue, false);
  assert.equal(plan.reason, "loop-budget-exhausted");
  assert.equal(plan.nextAutoLoop.exhausted, true);
});

test("plan: progress (new signature) resets the per-signature counter", () => {
  const plan = planAutoContinuation({
    state: { autoLoop: { signature: "req-1 pending", attempts: 2, total: 2, lastMessageID: "msg-1" } },
    gate: gate(["req-2 pending"]),
    assistantText: "DONE",
    messageID: "msg-2",
  });
  assert.equal(plan.continue, true);
  assert.equal(plan.nextAutoLoop.attempts, 1);
  assert.equal(plan.nextAutoLoop.total, 3);
});

test("plan: total budget stops progress-driven loops", () => {
  const plan = planAutoContinuation({
    state: { autoLoop: { signature: "old", attempts: 1, total: 10, lastMessageID: "msg-1" } },
    gate: gate(["req-2 pending"]),
    assistantText: "DONE",
    messageID: "msg-2",
    totalCap: 10,
  });
  assert.equal(plan.continue, false);
  assert.equal(plan.reason, "total-budget-exhausted");
});
