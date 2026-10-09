#!/usr/bin/env node
/**
 * benchmarks/cqe/run-benchmark.mjs — CLI entry for the CQE retrieval-quality harness.
 * Uso: node benchmarks/cqe/run-benchmark.mjs [--repo <path>]
 * Sin --repo usa una copia temporal del fixture tests/fixtures/cqe/sample-repo.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runQualityHarness } from './quality-harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(HERE, '../../tests/fixtures/cqe/sample-repo');

function parseArgs(argv) {
  const i = argv.indexOf('--repo');
  return i >= 0 ? argv[i + 1] : null;
}

const repoArg = parseArgs(process.argv.slice(2));
let repoRoot = repoArg;
let temp = null;
if (!repoRoot) {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-cqe-bench-'));
  fs.cpSync(FIXTURE, temp, { recursive: true });
  repoRoot = temp;
}

try {
  const { rows, summary } = await runQualityHarness({ repoRoot });
  console.log(`CQE retrieval-quality harness — repo=${repoRoot}`);
  console.log('task'.padEnd(28), 'mode'.padEnd(8), 'cqe', 'match', 'excl', 'P', 'R');
  for (const r of rows) {
    console.log(
      r.task.padEnd(28),
      r.mode.padEnd(8),
      String(r.cqeCount).padEnd(3),
      String(r.matches).padEnd(5),
      String(r.excluded).padEnd(4),
      r.precision.toFixed(2).padEnd(4),
      r.recall.toFixed(2)
    );
  }
  console.log('--- summary (enabled) ---');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
}
