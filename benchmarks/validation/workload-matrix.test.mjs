import test from "node:test";
import assert from "node:assert/strict";

import {
  WORKLOAD_FAMILIES,
  CONTINUATION_TURNS,
  CONTINUATION_SCENARIOS,
  WORKLOAD_SCENARIOS,
  getWorkloadScenario,
  simulateWorkload,
  simulateWorkloadMatrix,
} from "../scenarios/workloads.mjs";
import {
  CAUSAL_METRIC_KEYS,
  DERIVED_METRIC_KEYS,
  computeCausalMetrics,
  normalizeCounters,
} from "../evaluation/causal-metrics.mjs";

const finite = (n) => Number.isFinite(n);

test("workload matrix covers all four families", () => {
  assert.deepEqual(WORKLOAD_FAMILIES, ["local", "contextual", "continuation", "negative"]);

  const present = new Set(WORKLOAD_SCENARIOS.map((s) => s.family));
  for (const family of WORKLOAD_FAMILIES) {
    assert.ok(present.has(family), `missing family: ${family}`);
  }
});

test("continuation turn coverage is exactly 1/3/5/10/20", () => {
  assert.deepEqual(CONTINUATION_TURNS, [1, 3, 5, 10, 20]);
  assert.deepEqual(
    [...CONTINUATION_TURNS].sort((a, b) => a - b),
    [...CONTINUATION_TURNS].sort((a, b) => a - b),
  );

  const actual = WORKLOAD_SCENARIOS.filter((s) => s.family === "continuation").map((s) => s.turns.length);
  assert.deepEqual([...actual].sort((a, b) => a - b), CONTINUATION_TURNS);
  assert.equal(CONTINUATION_SCENARIOS.length, CONTINUATION_TURNS.length);

  for (const scenario of CONTINUATION_SCENARIOS) {
    assert.equal(scenario.turns.length, scenario.turnCount);
  }
});

test("continuation scenarios exercise the snapshot fast-path after turn 1", () => {
  for (const scenario of CONTINUATION_SCENARIOS) {
    assert.equal(scenario.turns[0].rebuildScope, "full", `${scenario.id} turn 1 must be cold`);
    for (const t of scenario.turns.slice(1)) {
      assert.equal(t.rebuildScope, "fast-path", `${scenario.id} must fast-path after turn 1`);
    }
    // repeated context payload: fast-path turns carry the same context as turn 1
    const first = JSON.stringify(scenario.turns[0].input);
    for (const t of scenario.turns.slice(1)) {
      assert.equal(JSON.stringify(t.input), first, `${scenario.id} context must repeat across turns`);
    }
  }
});

test("scenario ids are unique and descriptors are deterministic", () => {
  const ids = WORKLOAD_SCENARIOS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate scenario ids");

  assert.deepEqual(
    WORKLOAD_SCENARIOS.map((s) => s.id),
    ["local-1", "contextual-1", "continuation-1t", "continuation-3t", "continuation-5t", "continuation-10t", "continuation-20t", "negative-1"],
  );

  for (const id of ids) {
    assert.ok(getWorkloadScenario(id), `getWorkloadScenario must resolve ${id}`);
  }
  assert.equal(getWorkloadScenario("does-not-exist"), null);

  // build twice -> byte-identical descriptors (no RNG, no clock, no network in descriptor data)
  const once = JSON.stringify(WORKLOAD_SCENARIOS);
  const twice = JSON.stringify(WORKLOAD_SCENARIOS.map((s) => structuredClone(s)));
  assert.equal(once, twice);
  assert.deepEqual(simulateWorkloadMatrix(), simulateWorkloadMatrix());
});

test("simulated results are deterministic and produce a negative-family outcome", () => {
  const results = simulateWorkloadMatrix();
  const { scenarios, totals } = computeCausalMetrics({ scenarioResults: results });

  const expectedScenarios = new Map(WORKLOAD_SCENARIOS.map((s) => [s.id, s]));
  for (const entry of Object.values(scenarios)) {
    for (const key of CAUSAL_METRIC_KEYS) {
      assert.ok(key in entry, `${entry.scenarioId} missing causal metric ${key}`);
    }
    for (const key of DERIVED_METRIC_KEYS) {
      assert.ok(finite(totals[key]), `totals.${key} must be finite`);
    }
    assert.ok(finite(entry.totalTokens) && entry.totalTokens > 0);
    assert.equal(entry.verification, expectedScenarios.get(entry.scenarioId).expectedVerification);
  }

  const negative = scenarios["negative-1"];
  assert.ok(negative, "negative-1 must be present");
  assert.ok(
    negative.totalTokens > negative.baselineTotalTokens,
    "negative family must model WAM overhead exceeding savings",
  );
  assert.ok(totals.totalReductionPct > 0, "other families must still yield positive savings");
});

test("computeCausalMetrics emits every key per scenario and derived keys in totals", () => {
  const results = simulateWorkloadMatrix();
  const report = computeCausalMetrics({ scenarioResults: results });

  assert.equal(report.byScenario.length, results.length);
  assert.equal(Object.keys(report.scenarios).length, results.length);

  for (const entry of report.byScenario) {
    for (const key of CAUSAL_METRIC_KEYS) {
      assert.ok(key in entry, `missing ${key}`);
      if (key !== "verification") {
        assert.ok(finite(entry[key]), `${entry.scenarioId}.${key} must be a finite number`);
      }
    }
    // invariant: rebuilds partition into partial + full
    assert.equal(entry.contextRebuilds, entry.partialRebuildCount + entry.fullRebuildCount);
    assert.equal(entry.totalTokens, entry.inputTokens + entry.outputTokens);
  }

  for (const key of DERIVED_METRIC_KEYS) {
    assert.ok(key in report.totals, `totals missing ${key}`);
    assert.ok(finite(report.totals[key]), `totals.${key} must be finite`);
  }
});

test("negative-family results are preserved, never clamped to >= 0", () => {
  const negative = simulateWorkload(getWorkloadScenario("negative-1"));
  const { scenarios } = computeCausalMetrics({ scenarioResults: [negative] });

  const entry = scenarios["negative-1"];
  // baseline totals > wam totals => the honest reading is negative
  const baselineTotal = entry.baselineTotalTokens;
  assert.ok(baselineTotal > 0);
  const expectedPct = ((baselineTotal - entry.totalTokens) / baselineTotal) * 100;
  assert.ok(expectedPct < 0, "negative-1 must model a negative reduction");
  assert.ok(entry.totalTokens > baselineTotal);

  // per-scenario derived view: same non-clamping guarantee
  const totals = computeCausalMetrics({ scenarioResults: [negative] }).totals;
  assert.ok(totals.totalReductionPct < 0, "totalReductionPct must be preserved negative, not clamped");
  assert.notEqual(totals.totalReductionPct, 0);
  assert.ok(finite(totals.totalReductionPct));
});

test("divide-by-zero yields 0, never NaN or Infinity", () => {
  const empty = computeCausalMetrics({ scenarioResults: [] });
  for (const key of DERIVED_METRIC_KEYS) {
    assert.equal(empty.totals[key], 0, `empty matrix totals.${key} must be 0`);
  }

  const zeroed = computeCausalMetrics({
    scenarioResults: [
      {
        scenarioId: "zero",
        family: "local",
        turns: 0,
        collectorSnapshot: {},
        verification: false,
        tokens: { input: 0, output: 0, total: 0 },
      },
    ],
  });
  for (const key of DERIVED_METRIC_KEYS) {
    assert.equal(zeroed.totals[key], 0, `zero-denominator totals.${key} must be 0`);
  }
  for (const key of CAUSAL_METRIC_KEYS) {
    if (key === "verification") continue;
    assert.ok(finite(zeroed.scenarios.zero[key]), `zero-denominator ${key} must be finite`);
  }

  // non-finite inputs are coerced, not propagated
  const nasty = computeCausalMetrics({
    scenarioResults: [
      {
        scenarioId: "nasty",
        family: "local",
        turns: NaN,
        collectorSnapshot: { Context_reconstructed: undefined },
        verification: { testsPassed: true, equivalent: false },
        tokens: { input: NaN, output: Infinity, total: undefined },
      },
    ],
  });
  for (const key of CAUSAL_METRIC_KEYS) {
    if (key === "verification") continue;
    assert.ok(finite(nasty.scenarios.nasty[key]), `non-finite input leaked into ${key}`);
  }
  for (const key of DERIVED_METRIC_KEYS) {
    assert.ok(finite(nasty.totals[key]), `non-finite input leaked into totals.${key}`);
  }
});

test("verification is preserved as-is for booleans and state objects", () => {
  const state = { testsPassed: true, equivalent: true, filesExpected: true, success: true };
  const report = computeCausalMetrics({
    scenarioResults: [
      { scenarioId: "a", family: "local", turns: 1, collectorSnapshot: {}, verification: state, tokens: { input: 10, output: 2, total: 12 } },
      { scenarioId: "b", family: "negative", turns: 1, collectorSnapshot: {}, verification: false, tokens: { input: 10, output: 2, total: 12 } },
    ],
  });

  assert.deepEqual(report.scenarios.a.verification, state);
  assert.equal(report.scenarios.b.verification, false);
  assert.equal(report.totals.verifiedTasks, 1);
  assert.equal(report.totals.tokensPerVerifiedTask, 24);
});

test("normalizeCounters reads live collectors and plain snapshots alike", () => {
  const live = { record() {}, snapshot: () => ({ Context_fast_path: 3, bogus: 9 }) };
  const counters = normalizeCounters(live);
  assert.equal(counters.Context_fast_path, 3);
  assert.equal(counters.Snapshot_hit, 0);
  assert.equal("bogus" in counters, false);
  assert.equal(counters.Tokens_before, 0);
});
