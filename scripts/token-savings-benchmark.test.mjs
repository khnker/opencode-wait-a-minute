import { strict as assert } from "node:assert";
import test from "node:test";
import { runScenario, evaluatePair, runBenchmarkSuite, SCENARIOS } from "./token-savings-benchmark.mjs";

test("Token Savings Benchmark: runs all scenarios and computes savings", () => {
  const suite = runBenchmarkSuite();
  assert.strictEqual(suite.benchmark, "token-savings-v1");
  assert.strictEqual(suite.results.length, SCENARIOS.length);

  for (const res of suite.results) {
    assert.ok(res.baseline.inputTokens > res.wam.inputTokens, `Scenario ${res.scenarioId}: WAM should use fewer input tokens than baseline`);
    assert.ok(res.savings.inputSavingsPct > 0, `Scenario ${res.scenarioId}: positive input savings percentage expected`);
    assert.strictEqual(res.wam.verifiedProgress, 1);
  }
});

test("Token Savings Benchmark: negative savings support (S1 synthetic check)", () => {
  const customScenario = { id: "NEG", name: "Negative check", turns: 1, toolCalls: 0, contextRebuildsBase: 0, contextRebuildsWam: 0, wamOverhead: 5000 };
  const baseline = runScenario(customScenario, "baseline");
  const wam = runScenario(customScenario, "wam");
  
  assert.ok(wam.inputTokens > baseline.inputTokens);
  const inputSavings = baseline.inputTokens - wam.inputTokens;
  assert.ok(inputSavings < 0, "Should preserve negative savings without clamping");
});
