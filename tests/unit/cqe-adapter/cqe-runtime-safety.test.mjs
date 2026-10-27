import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materializeSnippet, retrieveWithCqe } from '../../../src/context/cqe-adapter.js';
import { FIXTURE_SRC, makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';

process.env.WAM_LOGGING = 'false';
process.env.WAM_LOG_FILE = path.join(os.tmpdir(), `wam-cqe-runtime-${process.pid}.log`);

const QUERY = 'FIND definitions OF symbol parseConfig';

const shape = (items) => items.map(({ id, path, content, startLine }) => ({ id, path, content, startLine }));

test('materializeSnippet leaves an escaping path untouched', () => {
  const root = makeFixtureRepo();
  try {
    const item = { path: '../secret.js', startLine: 1 };
    const out = materializeSnippet(item, root);
    assert.strictEqual(out, item);
    assert.strictEqual(out.content, undefined);
  } finally {
    cleanupRepo(root);
  }
});

test('empty query falls back to native without a CQE error', async () => {
  const r = await retrieveWithCqe('   ', { mode: 'enabled' });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.metadata.cqeError, null);
  assert.strictEqual(r.metadata.mode, 'enabled');
});

test('two fixture roots in sequence stay isolated and deterministic', async () => {
  const a = makeFixtureRepo();
  const b = makeFixtureRepo();
  try {
    const first = await retrieveWithCqe(QUERY, { repoRoot: a, mode: 'enabled' });
    const other = await retrieveWithCqe(QUERY, { repoRoot: b, mode: 'enabled' });
    const again = await retrieveWithCqe(QUERY, { repoRoot: a, mode: 'enabled' });

    assert.ok(first.cqeResult, 'root A should produce a CQE result');
    assert.ok(other.cqeResult, 'root B should produce a CQE result');
    assert.ok(again.cqeResult, 'root A should still produce a CQE result');
    assert.deepStrictEqual(shape(again.items), shape(first.items));
    assert.deepStrictEqual(
      other.items.map((i) => i.path),
      first.items.map((i) => i.path),
      'the same fixture content yields the same relative paths'
    );
  } finally {
    cleanupRepo(a);
    cleanupRepo(b);
  }
});

test('a failed engine init is not cached, so a later call retries', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-cqe-retry-'));
  const dir = path.join(parent, 'repo');
  try {
    const failed = await retrieveWithCqe(QUERY, { repoRoot: dir, mode: 'enabled' });
    assert.strictEqual(failed.source, 'wam-native');

    fs.cpSync(FIXTURE_SRC, dir, { recursive: true });
    const retried = await retrieveWithCqe(QUERY, { repoRoot: dir, mode: 'enabled' });
    assert.ok(retried.cqeResult, 'retry after init failure should reach CQE');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('shadow mode reports a CQE execution error as a fallback', async () => {
  const missing = path.join(os.tmpdir(), `wam-cqe-missing-${process.pid}-${Date.now()}`);
  const r = await retrieveWithCqe(QUERY, { repoRoot: missing, mode: 'shadow' });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.fallbackUsed, true);
  assert.strictEqual(r.metadata.fallbackReason, 'error');
  assert.ok(r.metadata.cqeError);
});

test('shadow mode reports an empty CQE result without a fallback', async () => {
  const root = makeFixtureRepo();
  try {
    const r = await retrieveWithCqe('FIND definitions OF symbol zzzzNonExistentSymbol123', {
      repoRoot: root,
      mode: 'shadow',
    });
    assert.strictEqual(r.source, 'wam-native');
    assert.strictEqual(r.metadata.empty, true);
    assert.strictEqual(r.fallbackUsed, false);
  } finally {
    cleanupRepo(root);
  }
});

test('disabled mode keeps the native result unmarked', async () => {
  const r = await retrieveWithCqe(QUERY, { mode: 'disabled' });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.fallbackUsed, false);
  assert.strictEqual(r.metadata.empty, false);
  assert.strictEqual(r.metadata.fallbackReason, undefined);
});
