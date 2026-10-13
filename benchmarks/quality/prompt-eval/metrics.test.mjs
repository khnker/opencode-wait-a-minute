import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateMetrics } from "./metrics.mjs";

function scenarioResult(id, severity, criteria, verdicts) {
  return { scenario: { id, severity, criteria }, verdicts };
}

describe("prompt-eval metrics aggregation", () => {
  it("computes mandatory compliance and evaluability counts", async () => {
    const criteria = [
      { id: "c1", kind: "must", required: true, check: "a" },
      { id: "c2", kind: "must", required: false, check: "b" },
    ];
    const results = [
      scenarioResult("s1", "critical", criteria, [
        { criterionId: "c1", passed: true, evaluable: true, evidence: "ok" },
        { criterionId: "c2", passed: false, evaluable: true, evidence: "missing" },
      ]),
    ];
    const metrics = aggregateMetrics(results);
    assert.strictEqual(metrics.totalScenarios, 1);
    assert.strictEqual(metrics.mandatoryCompliance, 100);
    assert.strictEqual(metrics.targetChecksPassed, 1);
    assert.strictEqual(metrics.evaluableCount, 1);
    assert.strictEqual(metrics.criticalRegressions, 0);
  });

  it("counts critical regression when critical scenario fails required criterion", async () => {
    const criteria = [{ id: "c1", kind: "must", required: true, check: "a" }];
    const results = [
      scenarioResult("s1", "critical", criteria, [
        { criterionId: "c1", passed: false, evaluable: true, evidence: "missing" },
      ]),
    ];
    const metrics = aggregateMetrics(results);
    assert.strictEqual(metrics.criticalRegressions, 1);
    assert.strictEqual(metrics.mandatoryCompliance, 0);
  });

  it("ignores non-evaluable scenarios for evaluableCount", async () => {
    const criteria = [{ id: "c1", kind: "must", required: true, check: "a" }];
    const results = [
      scenarioResult("s1", "low", criteria, [
        { criterionId: "c1", passed: false, evaluable: false, evidence: "empty" },
      ]),
    ];
    const metrics = aggregateMetrics(results);
    assert.strictEqual(metrics.evaluableCount, 0);
  });
});
