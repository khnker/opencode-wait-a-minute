import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECISIONS, classify } from "./decision.mjs";

function metrics({ evaluableCount = 1, totalScenarios = 1, mandatoryCompliance = 100, targetChecksPassed = 1, criticalRegressions = 0 }) {
  return { evaluableCount, totalScenarios, mandatoryCompliance, targetChecksPassed, criticalRegressions };
}

function details(passed = true, severity = "low") {
  return [{ scenarioId: "s1", severity, passed, evaluable: true, verdicts: [] }];
}

describe("prompt-eval decision rules", () => {
  it("PQ-006: candidate saves tokens BUT violates critical constraint → decision canNOT be IMPROVED", async () => {
    const baseline = { metrics: metrics({ targetChecksPassed: 10, criticalRegressions: 0 }), details: details(true, "critical") };
    const candidate = { metrics: metrics({ targetChecksPassed: 12, criticalRegressions: 1 }), details: details(false, "critical") };
    const result = classify(baseline, candidate);
    assert.notStrictEqual(result.decision, DECISIONS.IMPROVED);
  });

  it("PQ-007: candidate improves criteria with no critical regressions → MAY be IMPROVED when thresholds met", async () => {
    const baseline = { metrics: metrics({ targetChecksPassed: 10, criticalRegressions: 0 }), details: details(true) };
    const candidate = { metrics: metrics({ targetChecksPassed: 12, criticalRegressions: 0 }), details: details(true) };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.IMPROVED);
  });

  it("PQ-008: both versions equivalent → NO_CHANGE, not fictitious improvement", async () => {
    const baseline = { metrics: metrics({ targetChecksPassed: 10 }), details: details(true) };
    const candidate = { metrics: metrics({ targetChecksPassed: 10 }), details: details(true) };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.NO_CHANGE);
  });

  it("PQ-009: regression in critical scenario → REGRESSION even if global average improves", async () => {
    const baseline = { metrics: metrics({ criticalRegressions: 0 }), details: details(true, "critical") };
    const candidate = { metrics: metrics({ criticalRegressions: 1 }), details: details(false, "critical") };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.REGRESSION);
  });

  it("PQ-010: insufficient evidence to compare → INCONCLUSIVE", async () => {
    const result = classify({ metrics: metrics({ evaluableCount: 0 }), details: [] }, { metrics: metrics({ evaluableCount: 0 }), details: [] });
    assert.strictEqual(result.decision, DECISIONS.INCONCLUSIVE);
  });

  it("PQ-EXEC-02: deliberate critical regression => REGRESSION", async () => {
    const baseline = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, criticalRegressions: 0 }),
      details: [{ scenarioId: "s1", severity: "critical", passed: true, evaluable: true, criteria: [] }],
    };
    const candidate = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, criticalRegressions: 1 }),
      details: [{ scenarioId: "s1", severity: "critical", passed: false, evaluable: true, criteria: [] }],
    };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.REGRESSION);
    assert.ok(result.evidence.includes("critical"));
  });

  it("PQ-EXEC-04: identical outputs => NO_CHANGE", async () => {
    const baseline = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 10, criticalRegressions: 0 }),
      details: [{ scenarioId: "s1", severity: "low", passed: true, evaluable: true, criteria: [] }],
    };
    const candidate = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 10, criticalRegressions: 0 }),
      details: [{ scenarioId: "s1", severity: "low", passed: true, evaluable: true, criteria: [] }],
    };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.NO_CHANGE);
  });

  it("PQ-EXEC-03: empty/missing output => INCONCLUSIVE", async () => {
    const baseline = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1 }),
      details: [{ scenarioId: "s1", severity: "low", passed: true, evaluable: true, criteria: [] }],
    };
    const candidate = {
      metrics: metrics({ evaluableCount: 0, totalScenarios: 1 }),
      details: [{ scenarioId: "s1", severity: "low", passed: false, evaluable: false, criteria: [] }],
    };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.INCONCLUSIVE);
  });

  it("PQ-EXEC-05: savings + critical regression => REGRESSION (never IMPROVED)", async () => {
    const baseline = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, targetChecksPassed: 10, criticalRegressions: 0 }),
      details: [{ scenarioId: "s1", severity: "critical", passed: true, evaluable: true, criteria: [] }],
    };
    const candidate = {
      metrics: metrics({ evaluableCount: 1, totalScenarios: 1, targetChecksPassed: 12, criticalRegressions: 1 }),
      details: [{ scenarioId: "s1", severity: "critical", passed: false, evaluable: true, criteria: [] }],
    };
    const result = classify(baseline, candidate);
    assert.strictEqual(result.decision, DECISIONS.REGRESSION);
    assert.notStrictEqual(result.decision, DECISIONS.IMPROVED);
  });
});
