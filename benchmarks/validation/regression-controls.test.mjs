/**
 * Regression controls — the correctness assertions required by the spec.
 *
 * Spec: openspec/changes/harden-context-efficiency-validation/specs/regression-controls/spec.md
 *
 * These tests deliberately do NOT assert that WAM always saves tokens. They assert the
 * invariants that must hold even when savings are negative:
 *   - No False VALID      a mutated / stale / tampered snapshot is never classified VALID
 *   - No Skipped Rebuild  every non-VALID signal set triggers at least one rebuild level
 *   - No Stale Context    every stale/invalid signal maps to a rebuild; fast path only when unchanged
 *   - No Lost Verification `verification` survives the metric layer verbatim (negative controls included)
 *   - No Clamping         the negative family reports negative savings end to end
 *
 * Deterministic, offline, zero new deps. The WAM runtime is never touched: snapshots are only
 * written into throwaway temp roots.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkContinuation, createSnapshot, rebuildScope } from "../../src/context/context-snapshot.js";
import { createCollector } from "../instrumentation/collector.mjs";
import {
  SNAPSHOT_MATRIX,
  assertNoFalseValid,
  runSnapshotStateValidation,
} from "./snapshot-state.mjs";
import { computeCausalMetrics } from "../evaluation/causal-metrics.mjs";
import { savingsByScenarioSvg } from "../charts/charts.mjs";
import * as workloads from "../scenarios/workloads.mjs";

/* ------------------------------------------------------------------ *
 * Fixtures / helpers
 * ------------------------------------------------------------------ */

const PROBE_TASK_ID = "regression-probe";
const PROBE_GIT_SHA = "aaaa1111bbbb2222cccc3333";
const PROBE_TASK_STATE = Object.freeze({
  contract: { status: "APPROVED", rigor: "NORMAL" },
  requirements: [{ id: "R1", status: "MET" }],
  phase: "IMPLEMENTING",
  approvedStrategy: { strategy: "baseline", status: "ACTIVE", scope: "project" },
});

/**
 * Signal → rebuild mapping (spec: No Skipped Rebuild / No Stale Context).
 *   relevant-files | git-revision → N1 + N3 (project context)
 *   task-state     | no-snapshot  → N1 + N2 + N3 (full reconstruction)
 * A mixed signal set is the union of its signals, which is always the stricter superset.
 */
const FULL_REBUILD_SIGNALS = new Set(["task-state", "no-snapshot"]);

function expectedRebuildFor(signals) {
  return {
    rebuildN1: signals.length > 0,
    rebuildN2: signals.some((signal) => FULL_REBUILD_SIGNALS.has(signal)),
    rebuildN3: signals.length > 0,
  };
}

/** Temp root that always gets removed, so the suite leaves no residue. */
async function withTempRoot(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-regression-"));
  try {
    return await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function seedRoot(root) {
  fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(path.join(root, ".git", "refs", "heads", "main"), `${PROBE_GIT_SHA}\n`);
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "regression-fixture", version: "0.0.0" }, null, 2)}\n`
  );
}

function snapshotFile(root) {
  return path.join(root, ".wam", "snapshots", `${PROBE_TASK_ID}.json`);
}

const MUTATES_BY_ID = new Map(SNAPSHOT_MATRIX.map((c) => [c.id, c.mutates]));

/** Snapshot results may expose the fast-path flag at top level or nested under `actual`. */
function rebuildInvokedOf(result) {
  if (typeof result.rebuildInvoked === "boolean") return result.rebuildInvoked;
  if (typeof result.actual?.rebuildInvoked === "boolean") return result.actual.rebuildInvoked;
  const counters = result.counters ?? result.actual?.counters ?? {};
  const activity = (counters.Context_reconstructed ?? 0) + (counters.Context_fast_path ?? 0);
  return activity > 0;
}

function countersOf(result) {
  return result.counters ?? result.actual?.counters ?? undefined;
}

/** Parses the signed, unclamped plotted values a chart exposes via `data-series`. */
function svgDataSeries(svg) {
  const match = /data-series='([^']*)'/.exec(svg);
  assert.ok(match, "savingsByScenarioSvg must expose a data-series attribute");
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

/** Deep-collects `{ scenarioId → verification }` from any report-shaped payload. */
function collectVerifications(node, out = new Map()) {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectVerifications(item, out);
    return out;
  }
  if (typeof node.scenarioId === "string" && "verification" in node) {
    out.set(node.scenarioId, node.verification);
  }
  for (const value of Object.values(node)) collectVerifications(value, out);
  return out;
}

const isVerified = (state) =>
  state === true ||
  state === "success" ||
  state === "verified" ||
  state === "pass" ||
  (state !== null && typeof state === "object" && state.success === true);

const negativeResult = () => {
  const matrix = workloads.simulateWorkloadMatrix();
  const negative = matrix.find((result) => result.family === "negative");
  assert.ok(negative, "the workload matrix must contain a negative-control family");
  return negative;
};

/* ------------------------------------------------------------------ *
 * Spec scenarios
 * ------------------------------------------------------------------ */

describe("regression controls", () => {
  it("No False VALID: no mutated, stale or tampered snapshot is classified VALID", async () => {
    const results = await runSnapshotStateValidation();
    assert.equal(results.length, SNAPSHOT_MATRIX.length);

    assert.equal(
      assertNoFalseValid(results),
      true,
      "assertNoFalseValid must hold across the whole snapshot matrix"
    );

    for (const result of results) {
      const mutates = MUTATES_BY_ID.get(result.caseId);
      assert.equal(typeof mutates, "boolean", `unknown matrix case ${result.caseId}`);
      if (mutates) {
        assert.notEqual(
          result.actual.status,
          "VALID",
          `case ${result.caseId} mutated the context but was classified VALID`
        );
      }
    }

    // Explicit tampered-snapshot probe: stored taskStateHash no longer matches the real
    // task state, so continuation must never take the VALID fast path.
    await withTempRoot((root) => {
      seedRoot(root);
      createSnapshot(PROBE_TASK_ID, PROBE_TASK_STATE, root);

      const snapshot = JSON.parse(fs.readFileSync(snapshotFile(root), "utf-8"));
      fs.writeFileSync(
        snapshotFile(root),
        `${JSON.stringify({ ...snapshot, taskStateHash: "deadbeefdeadbeef" }, null, 2)}\n`
      );

      const check = checkContinuation(PROBE_TASK_ID, PROBE_TASK_STATE, root, createCollector());
      assert.notEqual(
        check.status,
        "VALID",
        "a snapshot whose taskStateHash was tampered with must not continue as VALID"
      );
      assert.equal(check.status, "INVALID");
      assert.ok(check.changedSignals.includes("task-state"));
    });
  });

  it("No Skipped Rebuild: every non-VALID signal set schedules at least one rebuild level", async () => {
    const results = await runSnapshotStateValidation();

    for (const result of results) {
      if (result.actual.status === "VALID") continue;

      const signals = result.actual.changedSignals;
      assert.ok(signals.length > 0, `case ${result.caseId} is ${result.actual.status} with no signal`);

      const rebuild = rebuildScope(signals, createCollector());
      const levels = ["rebuildN1", "rebuildN2", "rebuildN3"].filter((key) => rebuild[key] === true);
      assert.ok(
        levels.length > 0,
        `case ${result.caseId} (${signals.join(",")}) skipped every required rebuild`
      );

      const expected = expectedRebuildFor(signals);
      for (const key of ["rebuildN1", "rebuildN2", "rebuildN3"]) {
        assert.equal(
          rebuild[key],
          expected[key],
          `case ${result.caseId} (${signals.join(",")}) has unexpected ${key}`
        );
      }

      // Task-state / no-snapshot are the destructive families: nothing may be skipped.
      if (signals.some((signal) => FULL_REBUILD_SIGNALS.has(signal))) {
        assert.deepEqual(
          { ...rebuild },
          { rebuildN1: true, rebuildN2: true, rebuildN3: true },
          `case ${result.caseId} must rebuild fully`
        );
      }
    }
  });

  it("No Stale Context: stale task state or stale project context always triggers a rebuild", async () => {
    const results = await runSnapshotStateValidation();

    let staleCases = 0;
    for (const result of results) {
      const { status, changedSignals: signals } = result.actual;

      if (status !== "STALE" && status !== "INVALID") continue;
      staleCases += 1;

      assert.ok(
        signals.length > 0,
        `case ${result.caseId} reached execution as ${status} without any changed signal`
      );

      const rebuild = rebuildScope(signals, createCollector());
      const expected = expectedRebuildFor(signals);

      // Stale project context (relevant-files | git-revision) → N1 + N3.
      // Stale task state / missing snapshot (task-state | no-snapshot) → N1 + N2 + N3.
      assert.equal(rebuild.rebuildN1, expected.rebuildN1, `case ${result.caseId} skipped N1`);
      assert.equal(rebuild.rebuildN3, expected.rebuildN3, `case ${result.caseId} skipped N3`);
      if (signals.some((signal) => FULL_REBUILD_SIGNALS.has(signal))) {
        assert.equal(rebuild.rebuildN2, true, `case ${result.caseId} skipped N2 (full rebuild required)`);
      }

      // Anything rebuilt means the stale context cannot reach the final execution as-is.
      assert.equal(
        rebuildInvokedOf(result),
        true,
        `case ${result.caseId} is ${status} but performed no reconstruction`
      );
    }
    assert.ok(staleCases > 0, "the matrix must contain stale/invalid cases");

    // Fast path is only allowed when nothing changed at all.
    const valid = results.filter((result) => result.actual.status === "VALID");
    assert.ok(valid.length > 0, "the matrix must contain a VALID case");
    for (const result of valid) {
      assert.deepEqual(result.actual.changedSignals, [], `case ${result.caseId} reported signals while VALID`);
      assert.equal(
        rebuildInvokedOf(result),
        false,
        `case ${result.caseId} was VALID but still invoked a rebuild`
      );
      const counters = countersOf(result);
      if (counters) {
        assert.equal(counters.Context_reconstructed ?? 0, 0, `case ${result.caseId} reconstructed while VALID`);
      }
    }
  });

  it("No Lost Verification: verification survives the metric layer verbatim", () => {
    const scenarioResults = workloads.simulateWorkloadMatrix();
    assert.ok(scenarioResults.length > 0);

    const { scenarios, byScenario } = computeCausalMetrics({ scenarioResults });
    assert.equal(byScenario.length, scenarioResults.length);

    for (const result of scenarioResults) {
      const metric = scenarios[result.scenarioId];
      assert.ok(metric, `scenario ${result.scenarioId} is missing from the metrics`);

      assert.ok("verification" in metric, `scenario ${result.scenarioId} lost its verification field`);
      assert.notEqual(
        metric.verification,
        undefined,
        `scenario ${result.scenarioId} verification was dropped`
      );
      assert.deepEqual(
        metric.verification,
        result.verification,
        `scenario ${result.scenarioId} verification was altered (dropped, coerced or clamped)`
      );
    }
  });

  it("No Clamping: the negative-control family reports negative savings end to end", async () => {
    const negative = negativeResult();

    const single = computeCausalMetrics({ scenarioResults: [negative] });
    assert.ok(
      single.totals.totalReductionPct < 0,
      `negative control ${negative.scenarioId} reported totalReductionPct=${single.totals.totalReductionPct}, expected < 0`
    );

    const causal = computeCausalMetrics({ scenarioResults: workloads.simulateWorkloadMatrix() });
    const svg = savingsByScenarioSvg(causal);
    const series = svgDataSeries(svg).flat().filter((value) => typeof value === "number" && Number.isFinite(value));

    assert.ok(series.length > 0, "savingsByScenarioSvg plotted no values");
    assert.ok(
      series.some((value) => value < 0),
      `savingsByScenarioSvg clamped every value to >= 0 (plotted: ${JSON.stringify(series)})`
    );

    // Verification stays successful even though the negative control costs more tokens.
    const negativeEntry = causal.scenarios[negative.scenarioId];
    assert.deepEqual(negativeEntry.verification, negative.verification);
    assert.equal(
      isVerified(negativeEntry.verification),
      true,
      `negative control ${negative.scenarioId} lost successful verification`
    );
    assert.ok(
      causal.totals.totalReductionPct < causal.totals.inputReductionPct + Number.POSITIVE_INFINITY,
      "totals must remain numeric"
    );
  });

  it("No Lost Verification: the run-level validation report still reports verification", async () => {
    const scenarioResults = workloads.simulateWorkloadMatrix();
    const expected = new Map(
      scenarioResults.map((result) => [result.scenarioId, JSON.stringify(result.verification)])
    );

    const runner = await import("../run-validation.mjs");
    assert.equal(
      typeof runner.runValidationSuite,
      "function",
      "run-validation.mjs must export runValidationSuite for the report-level check"
    );

    const report = await runner.runValidationSuite({ outDir: fs.mkdtempSync(path.join(os.tmpdir(), "wam-run-")) });
    const reported = collectVerifications(report);

    assert.equal(reported.size, expected.size, "the report must carry one verification per scenario");
    for (const [scenarioId, value] of expected) {
      assert.equal(reported.has(scenarioId), true, `the report dropped scenario ${scenarioId}`);
      assert.equal(
        JSON.stringify(reported.get(scenarioId)),
        value,
        `the report altered verification for ${scenarioId}`
      );
    }
  });
});
