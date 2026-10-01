import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRuns, compareRuns, buildRealReport, RunResultFields } from "./compare-runs.mjs";
import { runRealSuite } from "../run-real.mjs";
import { RC1_SCENARIOS } from "../scenarios/rc1.mjs";

function sessionResult(scenarioId, turns) {
  return {
    scenarioId,
    turns: turns.map((t, i) => ({
      turnIndex: i,
      baseline: { usage: { inputTokens: t.baselineInput, outputTokens: t.baselineOutput ?? 1 } },
      wam: {
        usage: { inputTokens: t.wamInput, outputTokens: t.wamOutput ?? 1 },
        counters: { Tokens_after: t.contextTokens, Reconstruction_count: t.rebuilds ?? 0, Context_fast_path: t.fast ?? 0 }
      }
    }))
  };
}

test("normalizeRuns emits every RunResult field", () => {
  const runs = normalizeRuns(sessionResult("local", [{ baselineInput: 10, wamInput: 8, contextTokens: 15 }]), {
    model: "m",
    provider: "p"
  });
  assert.equal(runs.length, 1);
  for (const field of RunResultFields) {
    assert.ok(field in runs[0], `field ${field} missing`);
  }
  assert.equal(runs[0].turn, 0);
  assert.equal(runs[0].model, "m");
  assert.equal(runs[0].provider, "p");
});

test("normalizeRuns decomposes context vs overhead without double counting", () => {
  const [run] = normalizeRuns(sessionResult("x", [{ baselineInput: 100, wamInput: 100, contextTokens: 80, wamOutput: 5 }]));
  assert.equal(run.inputTokens, 80);
  assert.equal(run.wamOverheadTokens, 20);
  assert.equal(run.inputTokens + run.wamOverheadTokens, 100);
  assert.equal(run.totalTokens, 105);
});

test("compareRuns applies netInputSavings formula and preserves negatives", () => {
  const runs = normalizeRuns(sessionResult("negative-control", [
    { baselineInput: 50, wamInput: 80, contextTokens: 80, wamOutput: 10 }
  ]));
  const { netInputSavings, perScenario, totals } = compareRuns({ runs });
  assert.equal(netInputSavings, 50 - (80 + 0));
  assert.equal(totals.wamEffectiveInput, 80);
  assert.equal(perScenario["negative-control"].netInputSavings, netInputSavings);
  assert.ok(netInputSavings < 0);
});

test("compareRuns computes breakEvenTurn from cumulative continuation savings", () => {
  const runs = normalizeRuns(sessionResult("continuation", [
    { baselineInput: 100, wamInput: 150, contextTokens: 150 },
    { baselineInput: 100, wamInput: 50, contextTokens: 50 },
    { baselineInput: 100, wamInput: 10, contextTokens: 10 }
  ]));
  const { breakEvenTurn } = compareRuns({ runs });
  assert.equal(breakEvenTurn, 1);
});

test("compareRuns returns null breakEvenTurn when savings never recover", () => {
  const runs = normalizeRuns(sessionResult("continuation", [
    { baselineInput: 10, wamInput: 50, contextTokens: 50 },
    { baselineInput: 10, wamInput: 50, contextTokens: 50 }
  ]));
  assert.equal(compareRuns({ runs }).breakEvenTurn, null);
});

test("buildRealReport integrates runs, perScenario and totals", () => {
  const report = buildRealReport({
    sessionResults: [sessionResult("local", [{ baselineInput: 40, wamInput: 10, contextTokens: 10 }])],
    model: "m",
    provider: "p"
  });
  assert.equal(report.runs.length, 1);
  assert.equal(report.perScenario.local.turns, 1);
  assert.equal(report.netInputSavings, 30);
  assert.equal(report.totals.turns, 1);
});

test("dry-run suite normalizes into a non-empty real report", async () => {
  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);
  const provider = {
    model: "test/mock",
    complete: async ({ messages }) => {
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = "ok";
      return { text, usage: { inputTokens: estimateTokens(promptText), outputTokens: estimateTokens(text) } };
    }
  };
  const suite = await runRealSuite({ provider, scenarios: RC1_SCENARIOS });
  const report = buildRealReport({ sessionResults: suite.results, model: provider.model, provider: "mock" });
  const expectedTurns = RC1_SCENARIOS.reduce((sum, s) => sum + s.turns.length, 0);
  assert.equal(report.runs.length, expectedTurns);
  assert.equal(Object.keys(report.perScenario).length, RC1_SCENARIOS.length);
  assert.ok(Number.isFinite(report.netInputSavings));
  for (const run of report.runs) {
    for (const field of RunResultFields) {
      assert.ok(field in run, `field ${field} missing`);
    }
  }
});
