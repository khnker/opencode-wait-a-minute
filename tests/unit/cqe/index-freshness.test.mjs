import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';

// Keep CQE catalogs out of the real user cache.
const realHome = process.env.HOME;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-cqe-home-'));
process.env.HOME = tmpHome;

test.after(() => {
  process.env.HOME = realHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

test('ensureIndex reconciles files edited after the first build', async () => {
  const { ensureIndex } = await import('../../../vendor/context-query-core/src/index-ops.js');
  const { queryIndex } = await import('../../../vendor/context-query-core/src/index-layer/index.js');
  const root = makeFixtureRepo();
  try {
    assert.equal(ensureIndex(root, { ttlMs: 0 }), 1);
    assert.equal(queryIndex(root, 'symbol', 'freshSymbol', 5).length, 0);

    fs.appendFileSync(path.join(root, 'src/config.js'), '\nexport function freshSymbol() {\n  return 42;\n}\n');

    assert.equal(ensureIndex(root, { ttlMs: 0 }), 2);
    const found = queryIndex(root, 'symbol', 'freshSymbol', 5);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, 'src/config.js');
    assert.equal(found[0].span.start, 19);
  } finally {
    cleanupRepo(root);
  }
});

test('natural-language queries that start with a CQP verb do not fail', async () => {
  const { createEngine } = await import('../../../vendor/context-query-core/src/core.js');
  const root = makeFixtureRepo();
  try {
    const engine = createEngine({ repoRoot: root });
    const select = await engine.query('SELECT parseConfig', { budget: 4000 });
    assert.ok(select.results.length > 0);

    const list = await engine.query('LIST files in src', { budget: 4000 });
    assert.ok(Array.isArray(list.results));

    const malformed = await engine.query('FIND definitions OF symbol', { budget: 4000 });
    assert.ok(Array.isArray(malformed.results));
  } finally {
    cleanupRepo(root);
  }
});

test('valid CQP queries keep using the CQP path', async () => {
  const { createEngine } = await import('../../../vendor/context-query-core/src/core.js');
  const root = makeFixtureRepo();
  try {
    const engine = createEngine({ repoRoot: root });
    const result = await engine.query('FIND definitions OF symbol parseConfig', { budget: 4000 });
    assert.ok(result.results.length > 0);
    assert.ok(result.results.some((row) => row.path === 'src/config.js'));
  } finally {
    cleanupRepo(root);
  }
});
