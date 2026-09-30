import { strict as assert } from "node:assert";
import test from "node:test";
import { runBenchmarkSuite, BENCHMARK_VERSION } from "./run.mjs";
import { validateTrace } from "./trace-schema.mjs";
import { resolveProvenance } from "./provenance.mjs";
import { runTraceReplay } from "./runners/trace-replay.mjs";
import { summarizeSamples, summarizeRepeated } from "./analyzers/analyzer.mjs";
import { runRealModelBenchmark } from "./runners/real-model.mjs";
import { buildSummary, buildReport } from "./reporters/json-reporter.mjs";
import { classify, CLAIM_LEVELS } from "./reporters/claims.mjs";
import {
  tokenConsumptionSvg,
  contextConsumptionSvg,
  savingsDistributionSvg,
  verifiedProgressSvg
} from "./charts/charts.mjs";
import { TRACE_FIXTURES } from "./fixtures/traces.mjs";
import { SCENARIO_DEFINITIONS, getScenario } from "./scenarios/token-savings.mjs";

test("Schema: validateTrace", () => {
  assert.strictEqual(validateTrace({}).valid, false);
  const valid = { ...TRACE_FIXTURES.S1.baseline, provenance: { gitSha: "c1", dirty: false, resolvedAt: "2026-09-30" } };
  assert.strictEqual(validateTrace(valid).valid, true);
});

test("Provenance: resolveProvenance", () => {
  const p = resolveProvenance();
  assert.strictEqual(p.gitSha !== "HEAD", true);
  assert.strictEqual(typeof p.dirty, "boolean");
});

test("Trace replay deterministic", () => {
  const p = resolveProvenance();
  const r1 = runTraceReplay(p);
  const r2 = runTraceReplay(p);
  assert.deepEqual(r1.results, r2.results);
});

test("Negative savings preserved", () => {
  const suite = runTraceReplay();
  const s6 = suite.results.find(r => r.scenarioId === "S6");
  assert.ok(s6.savings.inputSavingsPct < 0);
});

test("Pairing condition", () => {
  const suite = runTraceReplay();
  for (const r of suite.results) {
    assert.strictEqual(r.baseline.condition, "baseline");
    assert.strictEqual(r.wam.condition, "wam");
  }
});

test("Repeated statistics", () => {
  const stats = summarizeSamples([10, 20, 30, 40, 50]);
  assert.strictEqual(stats.min, 10);
  assert.strictEqual(stats.median, 30);
  assert.strictEqual(stats.max, 50);
});

test("Summary reconstruction", () => {
  const suite = runTraceReplay();
  const summary = buildSummary(suite);
  assert.ok(summary.statistics);
});

test("Real-model opt-in", async () => {
  await assert.rejects(runRealModelBenchmark());
});
test("All scenarios present and savings are finite numerics", () => {
  const suite = runBenchmarkSuite();
  assert.strictEqual(suite.results.length, Object.keys(TRACE_FIXTURES).length);
  const ids = suite.results.map((r) => r.scenarioId);
  for (const id of ["S1", "S2", "S3", "S4", "S5", "S6"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  for (const r of suite.results) {
    assert.strictEqual(typeof r.savings.inputSavingsPct, "number");
    assert.ok(Number.isFinite(r.savings.inputSavingsPct));
  }
});
test("Claims classification maps token sources", () => {
  assert.strictEqual(classify("provider"), "observed");
  assert.strictEqual(classify({ tokenSource: "trace" }), "measured");
  assert.strictEqual(classify("estimated"), "estimated");
  const report = buildReport(runTraceReplay(), buildSummary(runTraceReplay()));
  for (const level of CLAIM_LEVELS) {
    assert.ok(report.includes(level), `report missing claim level ${level}`);
  }
});
test("Charts produce SVG", () => {
  const suite = runTraceReplay();
  const charts = [
    tokenConsumptionSvg(suite),
    contextConsumptionSvg(suite),
    savingsDistributionSvg(suite.results.map((r) => r.savings.inputSavingsPct)),
    verifiedProgressSvg(suite)
  ];
  for (const svg of charts) {
    assert.ok(typeof svg === "string" && svg.startsWith("<svg") && svg.endsWith("</svg>"));
  }
});
test("Every fixture has a scenario definition", () => {
  for (const id of Object.keys(TRACE_FIXTURES)) {
    assert.ok(getScenario(id), `missing scenario definition for ${id}`);
  }
  assert.strictEqual(SCENARIO_DEFINITIONS.length, Object.keys(TRACE_FIXTURES).length);
});
