/**
 * Skill-routing accuracy benchmark entry point.
 *
 * Runs the real WAM skill router over the accuracy corpus and writes a JSON
 * artifact to `benchmarks/results/skill-routing-<iso>.json`.
 *
 * Usage:
 *   node benchmarks/skill-routing.mjs
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSkillRoutingBenchmark } from "./real/runners/skill-routing-runner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..");
const RESULTS_DIR = join(__dirname, "results");

function isoTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function main() {
  console.error("Running skill-routing accuracy benchmark...");
  const results = await runSkillRoutingBenchmark({ projectPath: REPO });
  const timestamp = isoTimestamp();
  const artifact = {
    benchmark: "skill-routing-accuracy",
    timestamp,
    ...results,
  };
  const filename = `skill-routing-${timestamp}.json`;
  const outPath = join(RESULTS_DIR, filename);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    `accuracy=${(results.accuracy * 100).toFixed(1)}% recall=${(results.recall * 100).toFixed(1)}% precision=${(results.precision * 100).toFixed(1)}% f1=${(results.f1 * 100).toFixed(1)}%`
  );
  return artifact;
}

export { main, runSkillRoutingBenchmark, isoTimestamp };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
