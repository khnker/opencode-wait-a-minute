import test from "node:test";
import assert from "node:assert";
import { normalizeText, isEquivalent, equivalenceRate } from "./equivalence.mjs";
import { evaluateTask } from "./success.mjs";
import { computeMetrics } from "./metrics.mjs";
import { runRealSuite } from "../run-real.mjs";

test("equivalence", () => {
  assert.strictEqual(normalizeText("  Hello   World  "), "hello world");
  assert.strictEqual(isEquivalent("A", "a "), true);
  assert.strictEqual(isEquivalent("A", "B"), false);
  assert.strictEqual(equivalenceRate([]), 0);
  assert.strictEqual(equivalenceRate([["a", "a"], ["a", "b"]]), 50);
});

test("success", () => {
  const wam = { response: "test" };
  const baseline = { response: "test" };
  const eval1 = evaluateTask({ baseline, wam });
  assert.strictEqual(eval1.success, true);
  
  const eval2 = evaluateTask({ baseline, wam: { response: "diff" } });
  assert.strictEqual(eval2.success, false);
});

test("metrics", () => {
  const results = [
    {
      turns: [{ turnIndex: 0 }, { turnIndex: 1 }],
      totals: { wamTokens: 100, baselineTokens: 200 },
      counters: { Context_reconstructed: 1, Context_fast_path: 1 }
    }
  ];
  const evaluations = [
    { success: true, equivalent: true },
    { success: false, equivalent: false }
  ];
  const metrics = computeMetrics({ results, evaluations });
  assert.strictEqual(metrics.context_reduction, 50);
  assert.strictEqual(metrics.wam_overhead, 0);
  assert.strictEqual(metrics.net_input_savings, 50);
  assert.strictEqual(metrics.SuccessRate, 50);
  assert.strictEqual(metrics.EquivalenceRate, 50);
  assert.strictEqual(metrics.ReconstructionReductionPct, 50);
  assert.strictEqual(metrics.FastPathRate, 50);
  assert.strictEqual(metrics.TokensPerSuccessfulTask, 100);
});

test("integration", async () => {
  // Mock REAL_SCENARIOS for test
  const scenarios = [{ id: "S1", turns: [{ input: { taskState: {} } }] }];
  const fakeProvider = { 
    complete: async ({ messages }) => ({ 
      text: "response", 
      usage: { inputTokens: 100, outputTokens: 10 } 
    }) 
  };
  
  const suite = await runRealSuite({ provider: fakeProvider, scenarios });
  assert.strictEqual(suite.evaluations.length, 1);
  assert.strictEqual(suite.metrics.SuccessRate, 100);
});
