import test from 'node:test';
import assert from 'node:assert';
import { retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

test('disabled mode returns native context and never invokes CQE', async () => {
  const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', { mode: 'disabled' });
  assert.strictEqual(r.source, 'wam-native');
  assert.ok(Array.isArray(r.items));
  assert.strictEqual(r.metadata.mode, 'disabled');
  assert.strictEqual(r.metadata.cqeError, null);
});

test('enabled mode with null query falls back to native (no CQE call)', async () => {
  const r = await retrieveWithCqe(null, { mode: 'enabled' });
  assert.strictEqual(r.source, 'wam-native');
  assert.ok(Array.isArray(r.items));
});

test('enabled mode on a non-existent repo records an error and falls back', async () => {
  const r = await retrieveWithCqe('FIND definitions OF symbol parseConfig', {
    mode: 'enabled',
    repoRoot: '/nonexistent/repo/path/definitely-missing-xyz',
  });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.fallbackUsed, true);
  assert.ok(['error', 'empty'].includes(r.metadata.fallbackReason));
});

test('invalid mode defaults to disabled (safe default)', async () => {
  const r = await retrieveWithCqe('anything', { mode: 'bogus-mode' });
  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.metadata.mode, 'disabled');
});
