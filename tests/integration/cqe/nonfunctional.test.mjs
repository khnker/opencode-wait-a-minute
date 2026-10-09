import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { createCqeEngine, retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

function snapshot(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

test('RNF: engine exposes repo-scoped cache/index/budget config', () => {
  const engine = createCqeEngine({ repoRoot: '/tmp/whatever', cacheDir: '/tmp/c', indexDir: '/tmp/i', budget: 1234 });
  assert.strictEqual(engine.repoRoot, '/tmp/whatever');
  assert.strictEqual(engine.budget, 1234);
});

test('RNF: a query does not mutate the target repository', async () => {
  const dir = makeFixtureRepo();
  try {
    const before = snapshot(dir);
    await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    const after = snapshot(dir);
    assert.deepStrictEqual(after, before);
  } finally {
    cleanupRepo(dir);
  }
});

test('RNF: cold query completes within a generous time budget', async () => {
  const dir = makeFixtureRepo();
  try {
    const t0 = Date.now();
    await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 5000, `expected <5000ms, got ${elapsed}ms`);
  } finally {
    cleanupRepo(dir);
  }
});

test('RNF: package exposes context-query-core as a resolvable dependency', async () => {
  const mod = await import('context-query-core');
  assert.strictEqual(typeof mod.createEngine, 'function');
});
