/**
 * Zero-friction advisory — el contrato es informativo: nunca se pide
 * aprobación ni se bloquea el progreso.
 */

import test from "node:test";
import assert from "node:assert/strict";

import pluginDefault from "../index.js";
import { createContract } from "../src/verification/contract.js";
import { loadPrompt } from "../src/prompts/loader.js";

test("delegation directive is advisory: direct mutation stays allowed", () => {
  const text = loadPrompt("injection.delegation");
  assert.doesNotMatch(text, /BLOQUEADA/);
  assert.match(text, /PERMITIDA/);
  assert.match(text, /inline/);
});

test("createContract nace APPROVED (informativo)", () => {
  assert.equal(createContract([], []).status, "APPROVED");
});

test("presentValidation no pide aprobación y siempre continúa", async () => {
  const res = await pluginDefault.presentValidation({
    analysis: {
      phase: "PROPOSED",
      strategy: "NORMAL",
      nextAction: "Continuar",
      ambiguity: "low",
      intent: { classification: "task", confidence: 100 },
      project: { detected_stack: "node", architecture: "unknown" },
      known: [],
      inferred: [],
      assumed: [],
      unknown: [],
      risk: "low",
      complexity: "low",
      ready: true,
      advice: "",
      completionContract: {
        status: "PROPOSED",
        requirements: ["req-1"],
        unknowns: [{ id: "u-1", question: "alcance", status: "blocking" }],
        assumptions: [],
      },
      skills: { candidates: [], selected: [], rejected: [] },
    },
    emit: false,
  });

  const text = [res.advice, ...(res.validationLines || [])]
    .filter((l) => typeof l === "string")
    .join("\n");

  assert.equal(res.mode, "continue");
  assert.ok(!text.includes("¿Apruebo"), "sin pregunta de aprobación");
  assert.ok(!text.includes("validation-pending"), "sin estado de validación pendiente");
  assert.match(text, /Recomendación/);
});
