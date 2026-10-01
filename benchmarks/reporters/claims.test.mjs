import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  CLAIM_LEVELS,
  EVIDENCE_CATEGORIES,
  buildEvidence,
  DETERMINISTIC_EVIDENCE,
  EMPIRICAL_EVIDENCE
} from "./claims.mjs";
import { buildRealReport } from "../evaluation/compare-runs.mjs";

test("classify maps simulation sources to simulated", () => {
  assert.equal(classify("simulation"), "simulated");
  assert.equal(classify("simulated"), "simulated");
  assert.equal(classify("deterministic_simulation"), "simulated");
});

test("classify keeps provider as observed", () => {
  assert.equal(classify("provider"), "observed");
});

test("simulated claim is never observed", () => {
  const levels = ["simulation", "simulated", "deterministic_simulation", { tokenSource: "simulation" }, { tokenSource: "simulated" }];
  for (const input of levels) {
    assert.notEqual(classify(input), "observed");
  }
});

test("buildEvidence throws on unknown category value", () => {
  assert.throws(() => buildEvidence({ execution: "provider_execution", tokens: "guessed", correctness: "verified", mechanism: "measured" }), /tokens/);
  assert.throws(() => buildEvidence({ execution: "provider_execution", tokens: "observed", correctness: "verified", mechanism: "guessed" }), /mechanism/);
});

test("DETERMINISTIC_EVIDENCE tags synthetic path", () => {
  assert.equal(DETERMINISTIC_EVIDENCE.tokens, "simulated");
  assert.equal(DETERMINISTIC_EVIDENCE.execution, "deterministic_simulation");
  assert.equal(DETERMINISTIC_EVIDENCE.correctness, "fixture_defined");
});

test("EMPIRICAL_EVIDENCE tags provider path", () => {
  assert.equal(EMPIRICAL_EVIDENCE.tokens, "observed");
  assert.equal(EMPIRICAL_EVIDENCE.execution, "provider_execution");
  assert.equal(EMPIRICAL_EVIDENCE.correctness, "verified");
});

test("buildRealReport attaches EMPIRICAL_EVIDENCE", () => {
  const report = buildRealReport({ sessionResults: [], model: "m", provider: "p" });
  assert.equal(report.evidence.tokens, "observed");
  assert.equal(report.evidence.execution, "provider_execution");
});

test("CLAIM_LEVELS ordered low-to-high confidence", () => {
  assert.deepEqual(CLAIM_LEVELS, ["simulated", "estimated", "derived", "measured", "observed"]);
});

test("EVIDENCE_CATEGORIES exposes required axes", () => {
  assert.ok(Array.isArray(EVIDENCE_CATEGORIES.execution));
  assert.ok(Array.isArray(EVIDENCE_CATEGORIES.tokens));
  assert.ok(Array.isArray(EVIDENCE_CATEGORIES.correctness));
  assert.ok(Array.isArray(EVIDENCE_CATEGORIES.mechanism));
  assert.ok(EVIDENCE_CATEGORIES.execution.includes("deterministic_simulation"));
  assert.ok(EVIDENCE_CATEGORIES.execution.includes("provider_execution"));
  assert.ok(EVIDENCE_CATEGORIES.tokens.includes("simulated"));
  assert.ok(EVIDENCE_CATEGORIES.correctness.includes("fixture_defined"));
  assert.ok(EVIDENCE_CATEGORIES.correctness.includes("verified"));
});