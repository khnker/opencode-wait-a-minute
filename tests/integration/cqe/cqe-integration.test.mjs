import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { createCqeEngine, retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

test('INT-01: engine is repository-scoped', () => {
  const dir = makeFixtureRepo();
  try {
    const engine = createCqeEngine({ repoRoot: dir });
    assert.strictEqual(engine.repoRoot, dir);
  } finally {
    cleanupRepo(dir);
  }
});

test('INT-02/03: enabled mode retrieves fixture definitions via CQE', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
      repoRoot: dir,
      mode: 'enabled',
    });
    assert.ok(r.cqeResult, 'expected a CQE result object');
    const paths = (r.cqeResult.results || []).map((x) => x.path);
    assert.ok(paths.some((p) => /src\/(config|parser)\.js/.test(p)), `expected fixture paths, got ${paths}`);
  } finally {
    cleanupRepo(dir);
  }
});

test('INT-07: no .cqe artifact is written into the target repository', async () => {
  const dir = makeFixtureRepo();
  try {
    await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    assert.ok(!fs.existsSync(path.join(dir, '.cqe')), '.cqe must not be written into the target repo');
  } finally {
    cleanupRepo(dir);
  }
});

test('INT-08: retrieval is isolated to the target repo (no WAM paths leak)', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
      repoRoot: dir,
      mode: 'enabled',
    });
    const paths = (r.cqeResult?.results || []).map((x) => x.path);
    assert.ok(paths.length > 0, 'expected CQE results for fixture');
    assert.ok(!paths.some((p) => p.includes('wait-a-minute-plugin')), `leaked WAM paths: ${paths}`);
  } finally {
    cleanupRepo(dir);
  }
});

test('INT-04: unknown symbol yields zero CQE results', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol ZzzNoSuchSymbol42', {
      repoRoot: dir,
      mode: 'enabled',
    });
    const paths = (r.cqeResult?.results || []).map((x) => x.path);
    assert.strictEqual(paths.length, 0);
  } finally {
    cleanupRepo(dir);
  }
});

test('INT-05: explicit repoRoot is honored regardless of process.cwd()', async () => {
  const dir = makeFixtureRepo();
  const prev = process.cwd();
  try {
    process.chdir(os.tmpdir());
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
      repoRoot: dir,
      mode: 'enabled',
    });
    const paths = (r.cqeResult?.results || []).map((x) => x.path);
    assert.ok(paths.some((p) => /src\/(config|parser)\.js/.test(p)), `expected fixture paths, got ${paths}`);
  } finally {
    process.chdir(prev);
    cleanupRepo(dir);
  }
});

test('INT-06: shadow mode always returns native context and preserves CQE comparison', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
      repoRoot: dir,
      mode: 'shadow',
    });
    assert.strictEqual(r.source, 'wam-native');
    assert.ok('cqeResult' in r);
  } finally {
    cleanupRepo(dir);
  }
});
