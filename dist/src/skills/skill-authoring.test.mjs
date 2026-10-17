import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORING_PIPELINE,
  EXCLUSIONS,
  classifyArtifact,
  validateAuthoringRecord,
  detectDuplication,
  checkExclusions,
} from "./skill-authoring.js";

test("pipeline is ordered: baseline before verification", () => {
  assert.equal(AUTHORING_PIPELINE.length, 8);
  assert.equal(AUTHORING_PIPELINE[0], "scenario");
  assert.ok(AUTHORING_PIPELINE.indexOf("baseline") < AUTHORING_PIPELINE.indexOf("verify"));
});

test("classifies skill vs workflow vs constraint vs reference", () => {
  assert.equal(classifyArtifact({ steps: ["a", "b"] }), "workflow");
  assert.equal(classifyArtifact({ description: "Always run lint before commit" }), "constraint");
  assert.equal(classifyArtifact({ referenceOnly: true }), "reference");
  assert.equal(classifyArtifact({ name: "clean-code" }), "skill");
});

test("authoring record requires baseline captured before verification", () => {
  const bad = validateAuthoringRecord({ name: "x", scenario: { input: "i", expected_behavior: "e" } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("baseline.observed_behavior")));
  const good = validateAuthoringRecord({
    name: "x",
    scenario: { input: "i", expected_behavior: "e" },
    baseline: { observed_behavior: "fails" },
    verification: { evidence: "run log", result: "pass" },
  });
  assert.equal(good.ok, true);
});

test("detects duplication against registry", () => {
  const registry = [{ name: "deploy check", description: "verify deploy", triggers: ["deploy"] }];
  const dup = detectDuplication({ name: "deploy check", description: "verify deploy", triggers: ["deploy"] }, registry);
  assert.equal(dup.duplicate, true);
  const uniq = detectDuplication({ name: "quantum chemistry", description: "orbitals" }, registry);
  assert.equal(uniq.duplicate, false);
});

test("exclusions enumerated and enforced", () => {
  assert.equal(EXCLUSIONS.length, 4);
  assert.equal(checkExclusions({ oneOff: true }).reason, "one_off");
  assert.equal(checkExclusions({ mechanical: true }).reason, "mechanical");
  assert.equal(checkExclusions({ projectSpecific: true }).reason, "project_specific");
  assert.equal(checkExclusions({ duplicate: true }).reason, "duplicate");
  assert.equal(checkExclusions({}).ok, true);
});
