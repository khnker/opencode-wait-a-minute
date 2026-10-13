import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCriterion, evaluateScenario } from "./deterministic.mjs";

const criterion = {
  id: "test.criterion",
  kind: "must",
  required: true,
  check: "complete",
};

describe("prompt-eval deterministic evaluator", () => {
  it("PQ-005: missing output is not evaluable", async () => {
    const verdict = evaluateCriterion(criterion, "");
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.evaluable, false);
    assert.ok(verdict.evidence.length > 0);
  });

  it("passes a criterion when required keyphrase present", async () => {
    const verdict = evaluateCriterion(criterion, "Task is complete");
    assert.strictEqual(verdict.passed, true);
    assert.strictEqual(verdict.evaluable, true);
  });

  it("fails a must criterion when keyphrase absent", async () => {
    const verdict = evaluateCriterion(criterion, "Task is pending");
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.evaluable, true);
  });

  it("must-not criterion fails when forbidden phrase appears", async () => {
    const forbidden = { id: "test.forbidden", kind: "must-not", required: true, check: "DONE" };
    const verdict = evaluateCriterion(forbidden, "Declared DONE early");
    assert.strictEqual(verdict.passed, false);
  });

  it("evaluateScenario returns one verdict per criterion", async () => {
    const scenario = {
      id: "test.scenario",
      criteria: [criterion, { id: "test.forbidden", kind: "must-not", required: true, check: "DONE" }],
    };
    const verdicts = evaluateScenario(scenario, "Task complete");
    assert.strictEqual(verdicts.length, 2);
  });
});
