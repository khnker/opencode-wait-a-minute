/**
 * Long-context scaling benchmark entry point.
 *
 * Runs the continuation runner and writes a JSON artifact to
 * `benchmarks/results/long-context-<iso>.json`.
 *
 * Usage:
 *   node benchmarks/long-context.mjs
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runLongContextScaling } from "./real/runners/continuation-runner.mjs";
import { CONTINUATION_SIZES } from "./scenarios/continuation.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");

function isoTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Main entry.
 *
 * 1. Run the benchmark.
 * 2. Write the JSON artifact to `benchmarks/results/long-context-<iso>.json`.
 */
function main() {
  console.error("Running long-context scaling benchmark...");
  const results = runLongContextScaling({ sizes: CONTINUATION_SIZES });
  const timestamp = isoTimestamp();
  const artifact = {
    benchmark: "long-context-scaling",
    timestamp,
    sizes: CONTINUATION_SIZES,
    results
  };
  const filename = `long-context-${timestamp}.json`;
  const outPath = join(RESULTS_DIR, filename);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  // Also emit to stdout for piping / capture
  console.log(JSON.stringify(artifact, null, 2));
  return artifact;
}

export { main, runLongContextScaling, isoTimestamp };

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}