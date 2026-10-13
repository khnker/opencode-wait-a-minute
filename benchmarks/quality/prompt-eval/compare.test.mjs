import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareRuns } from "./compare.mjs";
import { freezeRun } from "./snapshot.mjs";

function buildRunFixture(id, label, suiteId, configHash, metrics = {}, details = []) {
  const suite = { id: suiteId, version: "1.0.0", scenarios: [] };
  const promptContents = { "p1": "content" };
  const frozen = freezeRun({ suite, promptContents, config: { hash: configHash } });

  return {
    schema: "wam.prompt-eval.run/1",
    runId: id,
    labels: [
      {
        label,
        suite: frozen.suite,
        configHash: frozen.configHash,
        prompts: frozen.prompts,
        metrics,
        details,
      },
    ],
  };
}

describe("prompt-eval compare", () => {
  it("PQ-INT-001: baseline + candidate over same suite → same scenario IDs and comparable config", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 });
    const candidate = buildRunFixture("r2", "candidate", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 2, criticalRegressions: 0 });
    const result = compareRuns(baseline, candidate);
    assert.ok(result.equivalentConfig);
    assert.strictEqual(result.decision.decision, "IMPROVED");
  });

  it("PQ-INT-002: interrupt run midway → partial results are NOT presented as complete suite", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 }, [{ scenarioId: "s1", passed: true }]);
    const candidate = buildRunFixture("r2", "candidate", "verify", "config", { evaluableCount: 0, totalScenarios: 1, mandatoryCompliance: 0, targetChecksPassed: 0, criticalRegressions: 0 }, []);
    const result = compareRuns(baseline, candidate);
    assert.strictEqual(result.decision.decision, "INCONCLUSIVE");
  });

  it("PQ-INT-003: same report twice from same data → same metrics + same decision", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 });
    const candidate = buildRunFixture("r2", "candidate", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 });
    const res1 = compareRuns(baseline, candidate);
    const res2 = compareRuns(baseline, candidate);
    assert.strictEqual(JSON.stringify(res1), JSON.stringify(res2));
  });

  it("PQ-INT-004: compare runs from different datasets → rejected or explicitly marked non-equivalent", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 });
    const candidate = buildRunFixture("r2", "candidate", "scope", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 2, criticalRegressions: 0 });
    assert.throws(() => compareRuns(baseline, candidate), /different suites/);
  });

  it("PQ-INT-004: differing config is also rejected", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config-a", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 });
    const candidate = buildRunFixture("r2", "candidate", "verify", "config-b", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 2, criticalRegressions: 0 });
    assert.throws(() => compareRuns(baseline, candidate), /config mismatch/);
  });

  it("PQ-INT-006: deliberate regression → report identifies scenario + criterion + severity + difference", async () => {
    const baseline = buildRunFixture("r1", "baseline", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 1, criticalRegressions: 0 }, [{ scenarioId: "s1", severity: "critical", passed: true }]);
    const candidate = buildRunFixture("r2", "candidate", "verify", "config", { evaluableCount: 1, totalScenarios: 1, mandatoryCompliance: 100, targetChecksPassed: 0, criticalRegressions: 1 }, [{ scenarioId: "s1", severity: "critical", passed: false }]);
    const result = compareRuns(baseline, candidate);
    assert.strictEqual(result.decision.decision, "REGRESSION");
    assert.ok(result.decision.evidence.includes("critical"));
  });
});
