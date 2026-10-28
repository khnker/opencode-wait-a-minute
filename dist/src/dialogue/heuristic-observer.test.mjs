import test from "node:test";
import assert from "node:assert/strict";

import { DIALOGUE_INTENTS } from "./observation.js";
import { heuristicObserve } from "./heuristic-observer.js";

const active = {
  requirements: [{ status: "pending" }],
  phase: "APPROVED",
  contract: { status: "APPROVED" },
};

test("status message is META with no contributions", () => {
  const obs = heuristicObserve({ message: "reiniciado ve si esta ok" });
  assert.equal(obs.intent, DIALOGUE_INTENTS.META);
  assert.equal(obs.contributions.length, 0);
});

test("initial goal is PROVIDE_REQUIREMENT", () => {
  const obs = heuristicObserve({ message: "Necesito un endpoint OAuth2" });
  assert.equal(obs.intent, DIALOGUE_INTENTS.PROVIDE_REQUIREMENT);
  assert.ok(obs.contributions.length >= 1);
});

test("definition becomes DEFINE with a constraint", () => {
  const obs = heuristicObserve({ message: "Debe usar JWT y expirar en 15 minutos" });
  assert.equal(obs.intent, DIALOGUE_INTENTS.DEFINE);
  assert.ok(obs.contributions.some((c) => c.kind === "constraint" || c.kind === "requirement"));
});

test("execution with an active task is EXECUTE", () => {
  const obs = heuristicObserve({ message: "hazlo", taskState: active });
  assert.equal(obs.intent, DIALOGUE_INTENTS.EXECUTE);
});

test("pending contract approval answers with APPROVE/REJECT", () => {
  const pending = {
    requirements: [{ status: "pending" }],
    phase: "PROPOSED",
    contract: { status: "PROPOSED" },
  };
  assert.equal(heuristicObserve({ message: "sí", taskState: pending }).intent, DIALOGUE_INTENTS.APPROVE);
  assert.equal(heuristicObserve({ message: "no", taskState: pending }).intent, DIALOGUE_INTENTS.REJECT);
});

test("completion claim wins over generic conversation", () => {
  const obs = heuristicObserve({ message: "listo, terminado" });
  assert.equal(obs.intent, DIALOGUE_INTENTS.CLAIM_DONE);
});

test("verification request is VERIFY", () => {
  const obs = heuristicObserve({ message: "verifica que los tests pasen", taskState: active });
  assert.equal(obs.intent, DIALOGUE_INTENTS.VERIFY);
});

test("destructive language raises risk flags", () => {
  const obs = heuristicObserve({ message: "borra la base de datos y usa la api key" });
  assert.ok(obs.risk_flags.includes("destructive"));
  assert.ok(obs.risk_flags.includes("secret"));
});
