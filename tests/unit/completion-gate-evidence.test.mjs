import test from "node:test";
import assert from "node:assert/strict";

import { evaluateCompletionGate } from "../../src/integration/orchestration.js";

const baseState = {
  contract: { status: "APPROVED", unknowns: [], assumptions: [], checks: [] },
  completionContract: { criteria: [] },
};

test("verified without evidence stays advisory (no bloquea)", () => {
  const gate = evaluateCompletionGate(
    {
      ...baseState,
      requirements: [{ id: "r1", title: "req", status: "verified", evidence: [] }],
    },
    "done"
  );

  assert.equal(gate.blocked, false, "el gate nunca bloquea: la falta de evidencia es advisory");
  assert.equal(gate.advisory, true);
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

  assert.equal(gate.blocked, false, "el gate nunca bloquea: queda como advisory");
  assert.equal(gate.advisory, true);
  assert.ok(
    gate.pending.every((p) => !p.includes("sin evidencia")),
    "evidence must satisfy the requirement checks"
  );
  assert.ok(
    gate.pending.some((p) => p.includes("Missing outcome contract")),
    "lo único que sigue pendiente es el outcome contract"
  );
  assert.match(gate.recommendation, /^Recomendación: /);
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

  assert.equal(gate.blocked, false, "el gate no depende del phrasing: nunca bloquea");
  assert.equal(gate.advisory, true);
  assert.ok(
    gate.pending.some((p) => p.includes("Missing outcome contract")),
    "evalúa el estado real aunque el prompt no pida completar"
  );
});
