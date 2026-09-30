#!/usr/bin/env node
/**
 * Deterministic validation runner.
 *
 * Pipeline: `simulateWorkloadMatrix()` → `computeCausalMetrics()` →
 * `runSnapshotStateValidation()` → `buildValidationReport()` → files on disk.
 *
 * Guarantees:
 *   - No network. Every input is a local, hard-coded deterministic model.
 *   - No `Date.now()` / RNG inside the produced evidence. The timestamp is used ONLY to
 *     name the output directory; it never reaches `raw.json`, `report.md` or the SVGs.
 *   - Snapshot validation writes to a temp root that is created and removed by this process;
 *     the WAM runtime itself is never touched.
 *
 * Usage:  node benchmarks/run-validation.mjs [--out <dir>]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { simulateWorkloadMatrix } from "./scenarios/workloads.mjs";
import { computeCausalMetrics } from "./evaluation/causal-metrics.mjs";
import { runSnapshotStateValidation, assertNoFalseValid } from "./validation/snapshot-state.mjs";
import { buildValidationReport } from "./reporters/validation-report.mjs";

export const VALIDATION_VERSION = "1.0.0";

const CHART_FILES = Object.freeze({
  rebuildVsToken: "rebuild-vs-token.svg",
  savingsByScenario: "savings-by-scenario.svg",
  continuationScaling: "continuation-scaling.svg",
  snapshotState: "snapshot-state.svg",
});

/** `--out <dir>` → absolute dir; anything else → `benchmarks/results/<iso-timestamp>`. */
function resolveOutDir(argv) {
  const idx = argv.indexOf("--out");
  if (idx !== -1 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
  const iso = new Date().toISOString().replace(/:/g, "-");
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "results", iso);
}

/**
 * Runs the whole validation pipeline.
 *
 * @param {{ outDir?: string, baseDir?: string }} [options]
 * @returns {Promise<{ outDir: string, causal: object, snapshot: Array<Object>, report: object, raw: object }>}
 */
export async function runValidationSuite(options = {}) {
  const outDir = options.outDir || resolveOutDir(process.argv.slice(2));

  const scenarioResults = simulateWorkloadMatrix();
  const causal = computeCausalMetrics({ scenarioResults });

  // Isolated temp root for the snapshot matrix; removed in runSnapshotStateValidation.
  const snapBase = options.baseDir || fs.mkdtempSync(path.join(os.tmpdir(), "wam-validation-"));
  let snapshot;
  try {
    snapshot = await runSnapshotStateValidation({ baseDir: snapBase });
  } finally {
    if (!options.baseDir) fs.rmSync(snapBase, { recursive: true, force: true });
  }
  assertNoFalseValid(snapshot);

  const report = buildValidationReport({ causal, snapshot });

  const raw = {
    validationVersion: VALIDATION_VERSION,
    composition: report.composition,
    causal,
    snapshot: snapshot.map((r) => ({
      caseId: r.caseId,
      description: r.description,
      mutates: r.mutates,
      expected: r.expected,
      actual: r.actual,
      rebuildInvoked: r.rebuildInvoked,
      pass: r.pass,
    })),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "raw.json"), `${JSON.stringify(raw, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "report.md"), report.markdown);

  const chartsDir = path.join(outDir, "charts");
  fs.mkdirSync(chartsDir, { recursive: true });
  for (const [key, file] of Object.entries(CHART_FILES)) {
    fs.writeFileSync(path.join(chartsDir, file), report.charts[key]);
  }

  return { outDir, causal, snapshot, report, raw };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { outDir, causal, report } = await runValidationSuite();
  const snapPassed = report.markdown.includes("Passed ");
  console.log(`Validation evidence written to: ${outDir}`);
  console.log(
    `  scenarios=${causal.byScenario.length} turns=${causal.totals.turns} ` +
      `rebuilds=${causal.totals.contextRebuilds} fastPath=${causal.totals.fastPathCount} ` +
      `reduction=${causal.totals.totalReductionPct}%`
  );
  console.log(`  charts=${Object.keys(CHART_FILES).length} snapshotReport=${snapPassed}`);
}