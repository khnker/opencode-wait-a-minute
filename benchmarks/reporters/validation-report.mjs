/**
 * Validation report — deterministic markdown + SVG bundle over the causal metrics and the
 * snapshot-state matrix.
 *
 * This is the presentation layer for `run-validation.mjs`. It performs no I/O, no clock
 * reads and no network: `buildValidationReport({ causal, snapshot })` is a pure function of
 * its inputs, so the same evidence always renders byte-identical markdown.
 *
 * Two honesty rules carried over from the causal layer and reasserted here:
 *   1. Negative savings are PRESERVED. A negative family (e.g. `negative-1`) reports a
 *      negative reduction and stays visible in both the table and the chart. Clamping to 0
 *      would make the negative control indistinguishable from a neutral scenario, which
 *      is precisely the signal that proves the harness can detect a regression.
 *   2. Snapshot state is reported per classification (VALID / STALE / INVALID) AND per
 *      pass/fail, so a misclassified case cannot hide behind a green total.
 */

import {
  rebuildVsTokenSvg,
  savingsByScenarioSvg,
  continuationScalingSvg,
  snapshotStateSvg,
} from "../charts/charts.mjs";
import { CAUSAL_METRIC_KEYS, DERIVED_METRIC_KEYS } from "../evaluation/causal-metrics.mjs";
import { WORKLOAD_FAMILIES, CONTINUATION_TURNS } from "../scenarios/workloads.mjs";
import { SNAPSHOT_MATRIX } from "../validation/snapshot-state.mjs";
import { DETERMINISTIC_EVIDENCE } from "./claims.mjs";

const SNAPSHOT_STATUSES = ["VALID", "STALE", "INVALID"];

/** Number of decimal places used for every rendered ratio — keeps output stable. */
const fmt = (value, digits = 2) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
};

/** Signed reduction % for one scenario. Kept unclamped on purpose. */
function reductionPct(baseline, wam) {
  if (!(baseline > 0)) return 0;
  return ((baseline - wam) / baseline) * 100;
}

function byScenarioRows(causal) {
  const entries = Array.isArray(causal?.byScenario) ? causal.byScenario : [];
  return entries.map((e) => ({
    scenarioId: String(e.scenarioId),
    family: String(e.family ?? "unknown"),
    turns: Number(e.turns) || 0,
    contextRebuilds: Number(e.contextRebuilds) || 0,
    fastPathCount: Number(e.fastPathCount) || 0,
    partialRebuildCount: Number(e.partialRebuildCount) || 0,
    fullRebuildCount: Number(e.fullRebuildCount) || 0,
    inputTokens: Number(e.inputTokens) || 0,
    totalTokens: Number(e.totalTokens) || 0,
    baselineTotalTokens: Number(e.baselineTotalTokens) || 0,
    reductionPct: reductionPct(Number(e.baselineTotalTokens) || 0, Number(e.totalTokens) || 0),
  }));
}

/**
 * Snapshot-state tally.
 * `expected` vs `actual` are both counted: a mismatch moves a case out of "passing" even
 * when the observed status happens to be one of the three known classifications.
 */
function snapshotSummary(snapshot) {
  const results = Array.isArray(snapshot) ? snapshot : [];
  const counts = Object.fromEntries(SNAPSHOT_STATUSES.map((s) => [s, 0]));
  const cases = results.map((r) => {
    const actual = r?.actual?.status ?? "UNKNOWN";
    if (counts[actual] === undefined) counts[actual] = 0;
    counts[actual] += 1;
    return {
      caseId: String(r?.caseId ?? "unknown"),
      mutates: r?.mutates === true,
      expected: String(r?.expected?.status ?? "UNKNOWN"),
      actual,
      rebuildInvoked: r?.rebuildInvoked === true,
      pass: r?.pass === true,
    };
  });
  return {
    counts,
    cases,
    total: results.length,
    matrixSize: SNAPSHOT_MATRIX.length,
    passed: cases.filter((c) => c.pass).length,
    failed: cases.filter((c) => !c.pass).length,
    // Guard from snapshot-state.mjs, mirrored as data: no mutated case may read VALID.
    falseValid: cases.filter((c) => c.mutates && c.actual === "VALID").map((c) => c.caseId),
  };
}

/** Continuation-family turn coverage actually observed, plus the expected coverage. */
function continuationCoverage(rows) {
  const observed = rows
    .filter((r) => r.family === "continuation")
    .map((r) => r.turns)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .sort((a, b) => a - b);
  return { observed, expected: [...CONTINUATION_TURNS] };
}

/**
 * Builds the validation report bundle.
 *
 * @param {{ causal: object, snapshot: Array<Object> }} args
 * @returns {{ markdown: string, charts: object, composition: object }}
 */
export function buildValidationReport({ causal, snapshot } = {}) {
  const rows = byScenarioRows(causal);
  const totals = causal?.totals ?? {};
  const snap = snapshotSummary(snapshot);
  const continuation = continuationCoverage(rows);
  const familiesPresent = WORKLOAD_FAMILIES.filter((f) => rows.some((r) => r.family === f));

  const composition = {
    families: [...WORKLOAD_FAMILIES],
    familiesPresent,
    scenarioCount: rows.length,
    turnCoverage: continuation.observed,
    expectedTurnCoverage: continuation.expected,
    scenarioIds: rows.map((r) => r.scenarioId),
  };

  const charts = {
    rebuildVsToken: rebuildVsTokenSvg(causal),
    savingsByScenario: savingsByScenarioSvg(causal),
    continuationScaling: continuationScalingSvg(causal),
    snapshotState: snapshotStateSvg(snapshot),
  };

  const lines = [];
  lines.push("# Context Efficiency — Deterministic Validation Report");
  lines.push("");
  lines.push(
    "Generated from the deterministic workload matrix (`simulateWorkloadMatrix`) and the " +
      "snapshot-state matrix (`runSnapshotStateValidation`). No network calls, no wall-clock " +
      "in the data: re-running this suite reproduces the same tables and the same SVG bytes."
  );
  lines.push("");

  lines.push("## Workload Composition");
  lines.push("");
  lines.push("| Dimension | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Families | ${composition.families.join(", ")} |`);
  lines.push(`| Families exercised | ${composition.familiesPresent.join(", ")} |`);
  lines.push(`| Scenarios | ${composition.scenarioCount} |`);
  lines.push(`| Turn coverage (observed) | [${composition.turnCoverage.join(", ")}] |`);
  lines.push(`| Turn coverage (required) | [${composition.expectedTurnCoverage.join(", ")}] |`);
  lines.push("");
  lines.push("Family roles:");
  lines.push("");
  lines.push("- `local` — single-turn, small scope. Baseline case for efficiency.");
  lines.push("- `contextual` — project-level context that must be re-read when it changes.");
  lines.push("- `continuation` — multi-turn sessions at 1/3/5/10/20 turns. This is where avoided");
  lines.push("  rebuilds compound: the baseline pays a full reconstruction per turn, WAM pays once.");
  lines.push("- `negative` — a control that MUST cost more. A negative reduction here is the");
  lines.push("  expected, correct result and is reported unclamped.");
  lines.push("");

  lines.push("## Derived Metrics (totals)");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  for (const key of DERIVED_METRIC_KEYS) {
    lines.push(`| ${key} | ${fmt(totals[key])} |`);
  }
  lines.push("");

  lines.push("## Per-Scenario Causal Metrics");
  lines.push("");
  lines.push(
    "| Scenario | Family | Turns | Rebuilds | Fast path | Partial | Full | Total tokens | " +
      "Baseline tokens | Reduction % |"
  );
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const r of rows) {
    lines.push(
      `| ${r.scenarioId} | ${r.family} | ${r.turns} | ${r.contextRebuilds} | ${r.fastPathCount} | ` +
        `${r.partialRebuildCount} | ${r.fullRebuildCount} | ${r.totalTokens} | ${r.baselineTotalTokens} | ` +
        `${fmt(r.reductionPct)} |`
    );
  }
  lines.push("");
  const negative = rows.filter((r) => r.reductionPct < 0);
  if (negative.length > 0) {
    lines.push(
      `Negative-control scenarios (${negative.map((r) => r.scenarioId).join(", ")}) report ` +
        "negative reduction by design. These are NOT clamped: a harness that hides them " +
        "could not distinguish a real regression from a neutral run."
    );
  } else {
    lines.push("No scenario reported a negative reduction.");
  }
  lines.push("");

  lines.push("## Snapshot State Validation");
  lines.push("");
  lines.push("| Classification | Cases |");
  lines.push("| --- | ---: |");
  for (const status of SNAPSHOT_STATUSES) {
    lines.push(`| ${status} | ${snap.counts[status] ?? 0} |`);
  }
  lines.push(`| **total** | ${snap.total} |`);
  lines.push("");
  lines.push(
    `Passed ${snap.passed}/${snap.total} cases (matrix declares ${snap.matrixSize}). ` +
      `False-valid cases: ${snap.falseValid.length === 0 ? "none" : snap.falseValid.join(", ")}.`
  );
  lines.push("");
  lines.push("| Case | Mutates | Expected | Actual | Rebuild invoked | Pass |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const c of snap.cases) {
    lines.push(
      `| ${c.caseId} | ${c.mutates} | ${c.expected} | ${c.actual} | ${c.rebuildInvoked} | ${c.pass} |`
    );
  }
  lines.push("");

  lines.push("## How to read this evidence");
  lines.push("");
  lines.push(
    "- **VALID** — snapshot still matches git, project context and task state. The turn runs on " +
      "the fast path: no reconstruction at all, `rebuildInvoked` is false."
  );
  lines.push(
    "- **STALE** — something outside the task state changed (git revision, relevant files). " +
      "Context is still usable, so a partial rebuild is enough."
  );
  lines.push(
    "- **INVALID** — the task state itself moved (phase/contract change) or the snapshot is " +
      "malformed/incompatible. A full rebuild is mandatory; never a fast path."
  );
  lines.push(
    "- **Fast path vs partial vs full** — the three rebuild scopes are the mechanism behind the " +
      "token deltas. `fastPathCount` is avoided work, `partialRebuildCount` is bounded rework, " +
      "`fullRebuildCount` is the fallback the harness must never be able to dodge."
  );
  lines.push(
    "- **Negative control** — the `negative` family is expected to increase cost. Its negative " +
      "savings value is the proof the measurement is sensitive in both directions."
  );
  lines.push(
    "- **Determinism** — the matrices contain no timestamps, RNG draws or network reads, so " +
      "these numbers are reproducible on any machine and safe to diff in CI."
  );
  lines.push("");

  lines.push("## Charts");
  lines.push("");
  lines.push("- `charts/rebuild-vs-token.svg` — rebuild count vs total tokens, per scenario.");
  lines.push("- `charts/savings-by-scenario.svg` — per-scenario reduction %, negatives included.");
  lines.push("- `charts/continuation-scaling.svg` — turns 1/3/5/10/20, baseline vs WAM tokens.");
  lines.push("- `charts/snapshot-state.svg` — VALID / STALE / INVALID counts.");
  lines.push("");

  lines.push(`Causal metric keys tracked: ${CAUSAL_METRIC_KEYS.join(", ")}.`);

  return { markdown: `${lines.join("\n")}\n`, charts, composition, evidence: DETERMINISTIC_EVIDENCE };
}

export { SNAPSHOT_STATUSES };