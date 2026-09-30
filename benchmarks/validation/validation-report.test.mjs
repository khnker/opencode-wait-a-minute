/**
 * Validation-report tests — deterministic assertions over the reporting layer.
 *
 * Guards the properties that make the evidence trustworthy rather than merely present:
 * charts render, composition is complete, derived metrics are total, snapshot counts add up,
 * and negative savings are NOT clamped.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { simulateWorkloadMatrix } from "../scenarios/workloads.mjs";
import { computeCausalMetrics, DERIVED_METRIC_KEYS } from "../evaluation/causal-metrics.mjs";
import { runSnapshotStateValidation, SNAPSHOT_MATRIX } from "./snapshot-state.mjs";
import { buildValidationReport } from "../reporters/validation-report.mjs";

const causal = computeCausalMetrics({ scenarioResults: simulateWorkloadMatrix() });

/** Snapshot matrix results, normalised once for every test in this file. */
let snapshotPromise;
function snapshotResults() {
  snapshotPromise ??= runSnapshotStateValidation();
  return snapshotPromise;
}

const CHART_KEYS = ["rebuildVsToken", "savingsByScenario", "continuationScaling", "snapshotState"];

test("report renders four non-empty <svg> charts", async () => {
  const { charts } = buildValidationReport({ causal, snapshot: await snapshotResults() });
  for (const key of CHART_KEYS) {
    assert.equal(typeof charts[key], "string", `${key} must be a string`);
    assert.ok(charts[key].length > 0, `${key} must be non-empty`);
    assert.ok(charts[key].startsWith("<svg"), `${key} must start with <svg`);
    assert.ok(charts[key].trimEnd().endsWith("</svg>"), `${key} must be a closed <svg>`);
  }
});

test("charts are deterministic: same input, byte-identical output", async () => {
  const snapshot = await snapshotResults();
  const first = buildValidationReport({ causal, snapshot });
  const second = buildValidationReport({ causal, snapshot });
  assert.equal(first.markdown, second.markdown);
  for (const key of CHART_KEYS) assert.equal(first.charts[key], second.charts[key]);
});

test("composition lists all four families and the full turn coverage", () => {
  const { composition } = buildValidationReport({ causal, snapshot: [] });
  assert.deepEqual(composition.families, ["local", "contextual", "continuation", "negative"]);
  assert.deepEqual(composition.turnCoverage, [1, 3, 5, 10, 20]);
  assert.deepEqual(composition.expectedTurnCoverage, [1, 3, 5, 10, 20]);
  // every family is actually exercised by the matrix, not merely declared
  assert.deepEqual(composition.familiesPresent, composition.families);
  assert.equal(composition.scenarioCount, causal.byScenario.length);
});

test("markdown carries a Workload Composition section with the coverage", () => {
  const { markdown } = buildValidationReport({ causal, snapshot: [] });
  assert.match(markdown, /^## Workload Composition$/m);
  assert.match(markdown, /local, contextual, continuation, negative/);
  assert.match(markdown, /\[1, 3, 5, 10, 20\]/);
});

test("totals contain every derived metric key", () => {
  const { markdown } = buildValidationReport({ causal, snapshot: [] });
  for (const key of DERIVED_METRIC_KEYS) {
    assert.ok(key in causal.totals, `${key} missing from totals`);
    assert.match(markdown, new RegExp(`\\| ${key} \\| -?\\d+\\.\\d{2} \\|`), `${key} missing from markdown`);
  }
});

test("markdown contains a per-scenario row for every scenario", () => {
  const { markdown } = buildValidationReport({ causal, snapshot: [] });
  for (const entry of causal.byScenario) {
    assert.match(markdown, new RegExp(`^\\| ${entry.scenarioId} \\|`, "m"), `missing row for ${entry.scenarioId}`);
  }
});

test("snapshot state counts sum to the matrix size", async () => {
  const results = await snapshotResults();
  const { markdown } = buildValidationReport({ causal, snapshot: results });
  const statuses = ["VALID", "STALE", "INVALID"];
  const counted = statuses.reduce(
    (acc, status) => acc + results.filter((r) => r.actual.status === status).length,
    0
  );
  assert.equal(counted, SNAPSHOT_MATRIX.length);
  for (const status of statuses) {
    const n = results.filter((r) => r.actual.status === status).length;
    assert.match(markdown, new RegExp(`^\\| ${status} \\| ${n} \\|`, "m"));
  }
  assert.match(markdown, new RegExp(`^\\| \\*\\*total\\*\\* \\| ${SNAPSHOT_MATRIX.length} \\|`, "m"));
  // every matrix case is reported
  for (const testCase of SNAPSHOT_MATRIX) {
    assert.ok(results.some((r) => r.caseId === testCase.id), `missing case ${testCase.id}`);
  }
});

test("negative-control savings are preserved, not clamped", () => {
  const negativeEntry = causal.byScenario.find((e) => e.family === "negative");
  assert.ok(negativeEntry, "matrix must contain a negative family scenario");
  const expectedReduction =
    ((negativeEntry.baselineTotalTokens - negativeEntry.totalTokens) / negativeEntry.baselineTotalTokens) * 100;
  assert.ok(expectedReduction < 0, "negative control must actually cost more");

  const { charts, markdown } = buildValidationReport({ causal, snapshot: [] });
  const svg = charts.savingsByScenario;

  // Read the plotted dataset straight off the SVG: the negative value must survive.
  const labels = JSON.parse(svg.match(/data-labels='([^']*)'/)[1]);
  const datasets = JSON.parse(svg.match(/data-series='([^']*)'/)[1]);
  const index = labels.indexOf(negativeEntry.scenarioId);
  assert.ok(index !== -1, `${negativeEntry.scenarioId} must be plotted`);
  const plotted = datasets.flat().at(index);
  assert.ok(plotted < 0, `expected a negative plotted value, got ${plotted}`);
  assert.ok(
    Math.abs(plotted - expectedReduction) < 0.5,
    `plotted ${plotted} should track measured ${expectedReduction}`
  );
  // clamping to 0 would leave every bar >= 0 and destroy the control's signal
  assert.ok(datasets.flat().some((v) => v < 0), "dataset must contain at least one negative value");

  // …and the report body states it rather than hiding it behind a 0 floor
  assert.match(markdown, new RegExp(`${negativeEntry.scenarioId}`));
  assert.match(markdown, /negative reduction by design/i);
});