// Artifact outcome benchmark — baseline vs WAM execution.
//
// Orchestrates each declared scenario twice (baseline runner, WAM
// runner), each on its own isolated fixture, verifies both outcomes
// with the independent verifier, and emits a deterministic report.
//
// Determinism contract: the report contains no timestamps and no
// durations — two runs over the same scenarios serialize identically.

import { pathToFileURL } from 'node:url';

import { runBaseline } from './baseline.mjs';
import { createFixtureRepo, cleanupFixtureRepo, writeFixtureFile } from './fixtures.mjs';
import { runWam } from './wam-runner.mjs';
import { verifyScenario } from './verifier.mjs';

export const BENCHMARK_NAME = 'artifact-outcome-benchmark';

export const SCENARIOS = [
  {
    id: 'create-artifact',
    operations: [
      {
        kind: 'create-artifact',
        relPath: 'artifacts/plan.md',
        content: '# Plan\n\n- deterministic\n',
      },
    ],
  },
  {
    id: 'update-artifact',
    seed: { relPath: 'artifacts/plan.md', content: '# Plan v1\n' },
    operations: [
      {
        kind: 'update-artifact',
        relPath: 'artifacts/plan.md',
        updatedContent: '# Plan v2\n',
      },
    ],
  },
];

function runScenario(scenario) {
  // Baseline arm — its own fixture.
  const baselineRoot = createFixtureRepo(`baseline-${scenario.id}`);
  let baselineRun;
  let baselineVerification;
  try {
    if (scenario.seed) writeFixtureFile(baselineRoot, scenario.seed.relPath, scenario.seed.content);
    baselineRun = runBaseline({ root: baselineRoot, operations: scenario.operations });
    baselineVerification = verifyScenario({ root: baselineRoot }, scenario);
  } finally {
    cleanupFixtureRepo(baselineRoot);
  }

  // WAM arm — its own fixture, fully isolated from the baseline arm.
  const wamRoot = createFixtureRepo(`wam-${scenario.id}`);
  let wamRun;
  let wamVerification;
  try {
    if (scenario.seed) writeFixtureFile(wamRoot, scenario.seed.relPath, scenario.seed.content);
    wamRun = runWam({
      root: wamRoot,
      operations: scenario.operations,
      // WAM reconstructs seeded artifacts as known state;
      // the fixture on disk holds the same seed content.
      seed: scenario.seed ? [scenario.seed] : [],
    });
    wamVerification = verifyScenario({ root: wamRoot }, scenario);
  } finally {
    cleanupFixtureRepo(wamRoot);
  }

  return {
    scenario: scenario.id,
    baseline: { executed: baselineRun.executed, verification: baselineVerification },
    wam: { events: wamRun.events, state: wamRun.state, verification: wamVerification },
    agreement: baselineVerification.ok === wamVerification.ok,
  };
}

/**
 * Run the full benchmark over the given scenarios.
 * @param {{ scenarios?: Array }} [options]
 * @returns {{ benchmark: string, deterministic: true, scenarios: Array, ok: boolean }}
 */
export function runBenchmark({ scenarios = SCENARIOS } = {}) {
  const results = scenarios.map(runScenario);
  return {
    benchmark: BENCHMARK_NAME,
    deterministic: true,
    scenarios: results,
    ok: results.every((r) => r.baseline.verification.ok && r.wam.verification.ok && r.agreement),
  };
}

// CLI entry point.
const isMain = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMain) {
  const report = runBenchmark();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}
