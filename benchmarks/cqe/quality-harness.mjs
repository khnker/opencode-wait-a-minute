/**
 * benchmarks/cqe/quality-harness.mjs — reproducible CQE retrieval-quality harness.
 *
 * Runs reference tasks against a target repo via the WAM adapter in a given mode
 * and reports precision/recall over the expected paths (baseline vs CQE).
 * Pure measurement: no task-state mutation, no writes into the target repo.
 */
import { retrieveWithCqe } from '../../src/context/cqe-adapter.js';

export const REFERENCE_TASKS = [
  {
    id: 'definitions-parseConfig',
    query: 'FIND definitions OF symbol parseConfig',
    expected: ['src/config.js'],
    mustExclude: ['generated/'],
  },
  {
    id: 'references-parseConfig',
    query: 'FIND references OF parseConfig',
    expected: ['src/parser.js'],
    mustExclude: ['generated/'],
  },
  {
    id: 'empty-symbol',
    query: 'FIND definitions OF symbol ZzzNoSuchSymbol42',
    expected: [],
    mustExclude: [],
  },
];

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export async function evaluateTask(task, { repoRoot, mode = 'enabled' }) {
  const r = await retrieveWithCqe(task.query, { repoRoot, mode });
  const cqePaths = (r.cqeResult?.results || []).map((x) => x.path);
  const nativeItems = (r.items || []).map((x) => x.path ?? x.file ?? '');
  const expected = task.expected || [];
  const hit = cqePaths.filter((p) => expected.some((e) => p.includes(e)));
  const excluded = cqePaths.filter((p) => (task.mustExclude || []).some((e) => p.includes(e)));
  const precision = cqePaths.length ? (hit.length - excluded.length) / cqePaths.length : 1;
  const recall = expected.length ? hit.length / expected.length : 1;
  return {
    task: task.id,
    query: task.query,
    mode,
    cqeCount: cqePaths.length,
    nativeCount: nativeItems.length,
    matches: hit.length,
    excluded: excluded.length,
    precision,
    recall,
    fallbackUsed: r.fallbackUsed ?? false,
    paths: cqePaths,
  };
}

export async function runQualityHarness({ repoRoot, tasks = REFERENCE_TASKS, modes = ['shadow', 'enabled'] }) {
  const rows = [];
  for (const mode of modes) {
    for (const task of tasks) rows.push(await evaluateTask(task, { repoRoot, mode }));
  }
  const enabled = rows.filter((r) => r.mode === 'enabled');
  return {
    repoRoot,
    rows,
    summary: {
      avgPrecision: mean(enabled.map((r) => r.precision)),
      avgRecall: mean(enabled.map((r) => r.recall)),
      avgCqeCount: mean(enabled.map((r) => r.cqeCount)),
      excludedTotal: enabled.reduce((a, r) => a + r.excluded, 0),
    },
  };
}
