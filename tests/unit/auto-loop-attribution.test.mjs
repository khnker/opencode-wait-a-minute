import test from "node:test";
import assert from "node:assert/strict";
import { planAutoContinuation, buildAutoLoopPrompt } from "../../src/execution/auto-continuation.js";

// Advisory gate: incomplete state nudges (blocked stays false) and the
// auto-loop still re-drives because automation is not friction.
const gate = { blocked: false, advisory: true, pending: ["req-1 — pendiente"] };

test("auto-loop: el prompt no se hace pasar por el usuario", () => {
  const plan = planAutoContinuation({ gate, state: {}, assistantText: "Listo, terminado.", cap: 3, totalCap: 10, messageID: "msg-1" });
  assert.equal(plan.continue, true);
  assert.match(plan.prompt, /^\[wam auto-loop\]/);
  assert.doesNotMatch(plan.prompt, /Listo, continúa/);
});

test("auto-loop: el turno inyectado es synthetic", () => {
  const plan = planAutoContinuation({ gate, state: {}, assistantText: "Listo, terminado.", cap: 3, totalCap: 10, messageID: "msg-2" });
  const body = buildAutoLoopPrompt(plan);
  assert.equal(body.parts.length, 1);
  assert.equal(body.parts[0].type, "text");
  assert.equal(body.parts[0].synthetic, true);
  assert.equal(body.parts[0].text, plan.prompt);
});
