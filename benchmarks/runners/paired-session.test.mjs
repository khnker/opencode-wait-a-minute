/**
 * Block 06 — empirical continuation + paired runs.
 *
 * Verifies that:
 *   - `buildContinuationScenarios` produces scenarios with the right turn
 *     counts and a SHARED taskId/taskState across turns (so the snapshot
 *     fast-path can kick in after turn 0).
 *   - `runRealSuite` with `trials: 2` emits results for every scenario ×
 *     trial combination, with a non-empty `pairId` and `trialId ∈ [0,1]`.
 *   - `buildRealReport` aggregates the runs into a `pairs` summary keyed
 *     by `pairId` and reports `totals.trials` equal to the distinct pair
 *     count.
 *   - The continuation-3 scenario reaches `snapshotStatus === "VALID"`
 *     and `fastPath === true` for turns 2 and 3.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildContinuationScenarios } from "../scenarios/continuation.mjs";
import { runRealSuite } from "../run-real.mjs";
import { buildRealReport } from "../evaluation/compare-runs.mjs";

function makeMockProvider() {
  return {
    model: "test/paired-mock",
    isConfigured: () => true,
    estimateTokens: (text = "") => Math.ceil(String(text).length / 4),
    complete: async ({ messages }) => {
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = "ok";
      const inputTokens = Math.ceil(promptText.length / 4);
      return { text, usage: { inputTokens, outputTokens: 1 } };
    }
  };
}

test("buildContinuationScenarios produces shared taskId/taskState across turns", () => {
  const scenarios = buildContinuationScenarios([1, 3]);
  assert.equal(scenarios.length, 2);

  const one = scenarios.find((s) => s.id === "continuation-1");
  const three = scenarios.find((s) => s.id === "continuation-3");
  assert.ok(one, "continuation-1 scenario missing");
  assert.ok(three, "continuation-3 scenario missing");
  assert.equal(one.turns.length, 1);
  assert.equal(three.turns.length, 3);
  assert.equal(one.family, "continuation");
  assert.equal(three.category, "continuation");

  // Every turn shares the SAME taskId + taskState reference so the snapshot
  // fast-path can match the prior snapshot after turn 0.
  for (const turn of three.turns) {
    assert.equal(turn.input.taskId, "continuation-3");
    assert.equal(turn.input.objective, "continuation-3");
    assert.deepEqual(turn.input.taskState, three.turns[0].input.taskState);
  }
});

test("runRealSuite with trials=2 emits one result per scenario×trial", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([1, 3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 2 });

  // 2 scenarios × 2 trials = 4 session results, with (1 + 3) = 4 turns each.
  assert.equal(suite.results.length, 4);
  const expectedTurns = scenarios.reduce((sum, s) => sum + s.turns.length, 0) * 2;
  assert.equal(
    suite.results.reduce((sum, r) => sum + r.turns.length, 0),
    expectedTurns
  );

  for (const res of suite.results) {
    assert.ok(typeof res.pairId === "string" && res.pairId.length > 0, "pairId missing");
    assert.ok([0, 1].includes(res.trialId), `unexpected trialId: ${res.trialId}`);
    assert.equal(res.pairId, `${res.scenarioId}#${res.trialId}`);
  }
});

test("buildRealReport aggregates per-pair results and reports trials count", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([1, 3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 2 });
  const report = buildRealReport({
    sessionResults: suite.results,
    model: provider.model,
    provider: "mock"
  });

  const expectedRuns = scenarios.reduce((sum, s) => sum + s.turns.length, 0) * 2;
  assert.equal(report.runs.length, expectedRuns);
  for (const run of report.runs) {
    assert.ok(typeof run.pairId === "string" && run.pairId.length > 0);
    assert.ok([0, 1].includes(run.trialId));
  }
  assert.equal(Object.keys(report.pairs).length, 4);
  assert.equal(report.totals.trials, 4);

  // Pairs summary is keyed by pairId and carries aggregate token accounting.
  for (const [pairId, entry] of Object.entries(report.pairs)) {
    assert.equal(pairId, entry.pairId);
    assert.ok([0, 1].includes(entry.trialId));
    assert.ok(entry.turns > 0);
    assert.equal(entry.netInputSavings, entry.baselineInputTokens - (entry.wamInputTokens + entry.wamOverheadTokens));
  }
});

test("continuation-3 reaches snapshotStatus=VALID and fastPath=true on turns 2 and 3", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1 });
  assert.equal(suite.results.length, 1);
  const turns = suite.results[0].turns;
  assert.equal(turns.length, 3);
  for (const idx of [1, 2]) {
    assert.equal(turns[idx].mechanism.snapshotStatus, "VALID", `turn ${idx} snapshot not VALID`);
    assert.equal(turns[idx].mechanism.fastPath, true, `turn ${idx} fastPath not true`);
  }
});
