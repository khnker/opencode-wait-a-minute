import test from "node:test";
import assert from "node:assert/strict";

import { evaluateCompletionGate } from "../../src/integration/orchestration.js";

const baseState = {
  contract: { status: "APPROVED", unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
};

test("verified without evidence is still blocked", () => {
  const gate = evaluateCompletionGate(
    {
      ...baseState,
      requirements: [{ id: "r1", title: "req", status: "verified", evidence: [] }],
    },
    "done"
  );

  assert.equal(gate.blocked, true);
  assert.ok(
    gate.pending.some((p) => p.includes("sin evidencia")),
    "verified-without-evidence must report the missing evidence"
  );
});

test("verified with evidence advances past the requirement checks", () => {
  const gate = evaluateCompletionGate(
    {
      ...baseState,
      requirements: [
        { id: "r1", title: "req", status: "verified", evidence: ["proof"] },
      ],
    },
    "done"
  );

  assert.equal(gate.blocked, true, "the outcome contract is still required");
  assert.ok(
    gate.pending.every((p) => !p.includes("sin evidencia")),
    "evidence must satisfy the requirement checks"
  );
  assert.ok(gate.pending.some((p) => p.includes("outcome contract")));
});

test("non-completion prompts still evaluate real state", () => {
  const gate = evaluateCompletionGate(
    {
      ...baseState,
      contract: { status: "PROPOSED", unknowns: [], assumptions: [], checks: [] },
      requirements: [],
    },
    "implementa lo siguiente"
  );

  assert.equal(gate.blocked, true, "the gate must not depend on completion phrasing");
});
