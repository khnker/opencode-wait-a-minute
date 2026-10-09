import test from 'node:test';
import assert from 'node:assert';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

function withEnv(key, value, fn) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  }
}

test('ORC: enabled success returns CQE source without fallback', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    assert.strictEqual(r.source, 'cqe');
    assert.strictEqual(r.fallbackUsed, false);
    assert.ok(r.items.length > 0);
  } finally {
    cleanupRepo(dir);
  }
});

test('ORC: disabled mode performs no CQE call and returns native context', async () => {
  const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { mode: 'disabled' });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.cqeResult ?? null, null);
  assert.strictEqual(r.metadata.mode, 'disabled');
});

test('ORC: WAM_CQE_MODE env selects the mode when none is passed', async () => {
  const dir = makeFixtureRepo();
  try {
    await withEnv('WAM_CQE_MODE', 'disabled', async () => {
      const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir });
      assert.strictEqual(r.metadata.mode, 'disabled');
    });
    await withEnv('WAM_CQE_MODE', 'shadow', async () => {
      const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir });
      assert.strictEqual(r.metadata.mode, 'shadow');
      assert.strictEqual(r.source, 'wam-native');
    });
  } finally {
    cleanupRepo(dir);
  }
});

test('ORC: repeated invocations are deterministic (no accumulated state)', async () => {
  const dir = makeFixtureRepo();
  try {
    const a = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    const b = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    const paths = (x) => (x.cqeResult?.results || []).map((r) => r.path).sort();
    assert.deepStrictEqual(paths(a), paths(b));
  } finally {
    cleanupRepo(dir);
  }
});

test('ORC: adapter result never carries task-state; it is retrieval-only', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { repoRoot: dir, mode: 'enabled' });
    assert.ok(!('taskState' in r));
    assert.ok(!('verified' in r));
    assert.ok(!('status' in r));
  } finally {
    cleanupRepo(dir);
  }
});

test('ORC: a very small timeout degrades safely to the native contract', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
      repoRoot: dir,
      mode: 'enabled',
      timeoutMs: 1,
    });
    assert.ok(Array.isArray(r.items));
    assert.strictEqual(typeof r.metadata.timedOut, 'boolean');
    if (r.metadata.timedOut) {
      assert.strictEqual(r.source, 'wam-native');
      assert.strictEqual(r.fallbackUsed, true);
      assert.strictEqual(r.metadata.fallbackReason, 'error');
    }
  } finally {
    cleanupRepo(dir);
  }
});
