// Baseline vs WAM execution runner for the artifact-outcome benchmark.
//
// Both runners replay the *same* deterministic executor behavior against an
// isolated fixture repo. The difference is purely how "done" is reported:
//
//   baseline  trusts the executor's completion claim
//   wam       derives completion from the independent verifier
//
// This isolates the effect being measured: outcome-based verification removes
// false completions without changing the underlying work.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanupFixtureRepo, createFixtureRepo } from './fixtures.mjs';
import { verifyOutcome } from './verifier.mjs';
import {
  BENCHMARK_ID,
  BENCHMARK_SEED,
  BENCHMARK_VERSION,
  EPISODES,
} from './episodes.mjs';

function writeTarget(root, relPath, content) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/** Seed the pre-existing repository state an update episode expects. */
export function seedEpisode(root, episode) {
  if (episode.initial != null) writeTarget(root, episode.targetPath, episode.initial);
}

/**
 * Apply the scripted executor behavior. Returns the executor's own claim.
 * @returns {{claim:boolean, wrote:boolean}}
 */
export function executeEpisode(root, episode) {
  switch (episode.behavior) {
    case 'faithful':
      writeTarget(root, episode.targetPath, episode.expected);
      return { claim: true, wrote: true };
    case 'noop':
      return { claim: true, wrote: false };
    case 'partial': {
      const cut = Math.max(1, Math.floor(episode.expected.length / 2));
      writeTarget(root, episode.targetPath, episode.expected.slice(0, cut));
      return { claim: true, wrote: true };
    }
    case 'corrupt':
      writeTarget(root, episode.targetPath, 'CORRUPTED\n');
      return { claim: true, wrote: true };
    case 'stale-update':
      writeTarget(root, episode.targetPath, episode.initial ?? '');
      return { claim: true, wrote: true };
    case 'honest-fail':
      return { claim: false, wrote: false };
    default:
      throw new Error(`unknown behavior: ${episode.behavior}`);
  }
}

/**
 * Run one episode under one mode in an isolated fixture repo.
 * @param {object} episode
 * @param {'baseline'|'wam'} mode
 */
export function runEpisode(episode, mode) {
  if (mode !== 'baseline' && mode !== 'wam') {
    throw new Error(`unknown mode: ${mode}`);
  }
  const root = createFixtureRepo(episode.id);
  try {
    seedEpisode(root, episode);
    const execution = executeEpisode(root, episode);
    const verification = verifyOutcome(root, episode);

    const actualSuccess = verification.ok;
    const reportedSuccess = mode === 'baseline' ? execution.claim : actualSuccess;

    return {
      episodeId: episode.id,
      kind: episode.kind,
      behavior: episode.behavior,
      mode,
      claim: execution.claim,
      reportedSuccess,
      actualSuccess,
      correct: reportedSuccess === actualSuccess,
      falseCompletion: reportedSuccess && !actualSuccess,
      missedCompletion: !reportedSuccess && actualSuccess,
      reason: verification.reason,
    };
  } finally {
    cleanupFixtureRepo(root);
  }
}

function aggregate(results) {
  const total = results.length;
  const count = (predicate) => results.filter(predicate).length;
  const correct = count((r) => r.correct);
  const falseCompletion = count((r) => r.falseCompletion);
  return {
    total,
    reportedSuccess: count((r) => r.reportedSuccess),
    actualSuccess: count((r) => r.actualSuccess),
    correct,
    falseCompletion,
    missedCompletion: count((r) => r.missedCompletion),
    outcomeAccuracy: total ? correct / total : 1,
    falseCompletionRate: total ? falseCompletion / total : 0,
  };
}

export function runMode(mode, episodes = EPISODES) {
  const results = episodes.map((episode) => runEpisode(episode, mode));
  return { mode, ...aggregate(results), results };
}

/**
 * Run the full deterministic benchmark and return a serializable report.
 * @param {{episodes?: ReadonlyArray<object>}} [options]
 */
export function runArtifactOutcomeBenchmark({ episodes = EPISODES } = {}) {
  const baseline = runMode('baseline', episodes);
  const wam = runMode('wam', episodes);

  return {
    benchmarkId: BENCHMARK_ID,
    version: BENCHMARK_VERSION,
    deterministic: true,
    seed: BENCHMARK_SEED,
    episodeCount: episodes.length,
    modes: { baseline, wam },
    delta: {
      falseCompletionReduction: baseline.falseCompletion - wam.falseCompletion,
      outcomeAccuracyGain: Number((wam.outcomeAccuracy - baseline.outcomeAccuracy).toFixed(6)),
    },
  };
}
