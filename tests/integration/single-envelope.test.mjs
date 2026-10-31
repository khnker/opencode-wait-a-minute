import test from "node:test";
import assert from "node:assert/strict";

import plugin from "../../index.js";
import { mergeValidationLines, wrapWamBlock } from "../../src/integration/message-handler.js";

const ANALYSIS = {
  intent: { classification: "normal", confidence: 90 },
  project: { detected_stack: "node", architecture: "unknown" },
  known: [],
  inferred: [],
  assumed: [],
  unknown: [],
  strategy: "NORMAL",
  contractStatus: "PROPOSED",
  phase: "IMPLEMENTING",
  completionContract: {
    status: "PROPOSED",
    requirements: ["req-1"],
    unknowns: [],
    assumptions: [],
  },
  skills: { selected: [], candidates: [], rejected: [] },
  risk: "low",
  complexity: "low",
  ambiguity: "low",
  ready: true,
  advice: "",
  nextAction: "Implement the change",
};

test("presentValidation emit:false returns lines without emitting parts", async () => {
  const parts = [];
  const result = await plugin.presentValidation({
    analysis: ANALYSIS,
    ctx: { parts, message: { id: "m1" } },
    emit: false,
  });
  assert.equal(parts.length, 0, "no-emit mode must not write parts");
  assert.equal(result.mode, "continue", "presentValidation is always advisory");
  assert.ok(Array.isArray(result.validationLines));
  assert.ok(
    result.validationLines.some((line) => line.includes("Recomendación — contrato")),
    "the contract line is a recommendation, not an approval wait"
  );
  assert.ok(
    !result.validationLines.some((line) => line.includes("Intervención activa")),
    "no intervention/approval gate in the notice"
  );
});

test("validation, phase and CQE summary travel in a single [wam] envelope", async () => {
  const result = await plugin.presentValidation({
    analysis: ANALYSIS,
    ctx: null,
    emit: false,
  });
  const inject = [];
  assert.equal(mergeValidationLines(inject, result), true);
  inject.push(`fase ${ANALYSIS.phase} → ${ANALYSIS.nextAction}`);
  inject.push("cqe: 2 archivos en 64ms — top: src/a.mjs, src/b.mjs");

  const parts = [wrapWamBlock(inject.join("\n"))];
  const envelopes = parts.filter((part) => part.startsWith("[wam][start]"));
  const standalone = parts.filter((part) => part.startsWith("[wam]") && !part.startsWith("[wam][start]"));

  assert.equal(envelopes.length, 1, "exactly one envelope part");
  assert.equal(standalone.length, 0, "no standalone [wam] part");
  assert.ok(envelopes[0].endsWith("[wam][end]"));
  assert.ok(envelopes[0].includes("Recomendación — contrato"));
  assert.ok(envelopes[0].includes("fase IMPLEMENTING"));
  assert.ok(envelopes[0].includes("cqe: 2 archivos"));
  assert.ok(!envelopes[0].includes("call the task tool with subagent"));
});
