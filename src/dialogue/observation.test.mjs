import test from "node:test";
import assert from "node:assert/strict";

import {
  DIALOGUE_INTENTS,
  emptyObservation,
  mergeObservations,
  normalizeObservation,
  validateObservation,
} from "./observation.js";

test("normalizeObservation clamps and defaults invalid values", () => {
  const obs = normalizeObservation({
    intent: "NOT_REAL",
    confidence: 9,
    contributions: [{ kind: "requirement", text: "  usar JWT  ", confidence: 2 }],
    risk_flags: ["destructive", "unknown"],
  });
  assert.equal(obs.intent, DIALOGUE_INTENTS.UNKNOWN);
  assert.equal(obs.confidence, 1);
  assert.equal(obs.contributions[0].text, "usar JWT");
  assert.equal(obs.contributions[0].confidence, 1);
  assert.deepEqual(obs.risk_flags, ["destructive"]);
});

test("validateObservation rejects out-of-range confidence", () => {
  const result = validateObservation({ intent: DIALOGUE_INTENTS.DEFINE, confidence: 2 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /confidence/);
});

test("mergeObservations keeps semantic intent and dedupes contributions", () => {
  const merged = mergeObservations(
    { intent: DIALOGUE_INTENTS.DEFINE, confidence: 0.9, contributions: [{ kind: "constraint", text: "usar JWT" }] },
    emptyObservation({
      intent: DIALOGUE_INTENTS.UNKNOWN,
      confidence: 0.4,
      contributions: [{ kind: "constraint", text: "usar JWT" }],
    })
  );
  assert.equal(merged.intent, DIALOGUE_INTENTS.DEFINE);
  assert.equal(merged.confidence, 0.9);
  assert.equal(merged.contributions.length, 1);
});
