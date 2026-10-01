#!/usr/bin/env node
/**
 * RC1 evidence report CLI.
 *
 * Generates the six-artifact RC1 bundle. With no arguments it reads the newest
 * benchmark evidence under `benchmarks/results/` and writes to
 * `benchmarks/reports/rc1/`.
 *
 * Usage:
 *   node benchmarks/reports/generate-rc1.mjs [--out=<dir>]
 *
 * Flags:
 *   --out=<dir>   write the bundle to <dir> instead of benchmarks/reports/rc1
 *
 * Exit code 0 on success, 1 on failure.
 */

import fs from "node:fs";
import path from "node:path";
import { generateRc1Report } from "../reporters/rc1-report.mjs";

function parseArgs(argv) {
  const out = { dir: null };
  for (const tok of argv.slice(2)) {
    if (tok.startsWith("--out=")) out.dir = tok.slice("--out=".length).trim();
    else if (tok === "--help" || tok === "-h") out.help = true;
  }
  if (out.dir) out.dir = path.resolve(out.dir);
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("Usage: node benchmarks/reports/generate-rc1.mjs [--out=<dir>]");
    return 0;
  }
  const result = generateRc1Report(args.dir ? { outDir: args.dir } : {});
  console.log(`RC1 evidence report written to: ${result.outDir}`);
  console.log(`  artifacts: ${result.artifacts.join(", ")}`);
  console.log(
    `  internalDeterministic: snapshotPassed=${result.internal.snapshotCorrectness.passed}` +
      `/${result.internal.snapshotCorrectness.cases}` +
      ` fastPath=${result.internal.fastPath.count}`
  );
  console.log(
    `  empiricalReal: outcomeMatch=${result.empirical.outcomeEquivalence.outcomeMatch}` +
      `/${result.empirical.outcomeEquivalence.evaluated}` +
      ` invalidComparisons=${result.empirical.INVALID_COMPARISON.length}`
  );
  console.log(
    `  externalEvidence: ${result.external.sourceCount} sources` +
      ` (cachedTokensReportedSeparately=${result.external.cachedTokensReportedSeparately})`
  );
  return 0;
}

try {
  process.exit(main(process.argv));
} catch (err) {
  console.error(err.stack || err.message);
  process.exit(1);
}
