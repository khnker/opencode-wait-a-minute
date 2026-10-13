// Artifact-outcome benchmark entry point.
//
// Deterministic harness comparing baseline (trust-the-claim) completion with
// WAM (verified-outcome) completion for `create-artifact` and `update-artifact`
// tasks. Run directly to print the JSON report:
//
//   node benchmarks/artifact-outcome/index.mjs

import { pathToFileURL } from 'node:url';
import { runArtifactOutcomeBenchmark } from './runner.mjs';
import {
  BENCHMARK_ID,
  BENCHMARK_SEED,
  BENCHMARK_VERSION,
  EPISODES,
} from './episodes.mjs';

export {
  BENCHMARK_ID,
  BENCHMARK_SEED,
  BENCHMARK_VERSION,
  EPISODES,
  runArtifactOutcomeBenchmark,
};

/** Stable serialization: identical input always yields identical bytes. */
export function serializeReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  process.stdout.write(serializeReport(runArtifactOutcomeBenchmark()));
}
