import test from 'node:test';
import assert from 'node:assert';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

async function fetch(query, repoRoot, constraints = {}) {
  return retrieveWithCqe(query, { repoRoot, mode: 'enabled', ...constraints });
}

test('REC: enabled mode locates a symbol definition in the target repo', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await fetch('FIND definitions OF symbol parseConfig', dir);
    const paths = (r.cqeResult?.results || []).map((x) => x.path);
    assert.ok(paths.includes('src/config.js'), `expected src/config.js, got ${paths}`);
  } finally {
    cleanupRepo(dir);
  }
});

test('REC: generated/ignored files are excluded from indexed evidence', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await fetch('FIND definitions OF symbol parseConfig', dir);
    const paths = (r.cqeResult?.results || []).map((x) => x.path);
    assert.ok(!paths.some((p) => p.startsWith('generated/')), `generated/ leaked: ${paths}`);
  } finally {
    cleanupRepo(dir);
  }
});

test('REC: unknown symbol yields no evidence and no fabrication', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await fetch('FIND definitions OF symbol ZzzNoSuchSymbol42', dir);
    assert.strictEqual((r.cqeResult?.results || []).length, 0);
    assert.strictEqual(r.metadata.empty, true);
    assert.strictEqual(r.fallbackUsed, true);
  } finally {
    cleanupRepo(dir);
  }
});

test('REC: returned items carry CQE provenance', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await fetch('FIND definitions OF symbol parseConfig', dir);
    assert.ok(r.items.length > 0);
    for (const item of r.items) {
      assert.strictEqual(item.provenance.source, 'cqe');
      assert.strictEqual(item.provenance.query, 'FIND definitions OF symbol parseConfig');
      assert.strictEqual(typeof item.provenance.elapsedMs, 'number');
    }
  } finally {
    cleanupRepo(dir);
  }
});

test('REC: maxResults caps the returned CQE items', async () => {
  const dir = makeFixtureRepo();
  try {
    const r = await fetch('FIND definitions OF symbol parseConfig', dir, { maxResults: 1 });
    assert.ok(r.items.length <= 1, `expected <=1 items, got ${r.items.length}`);
  } finally {
    cleanupRepo(dir);
  }
});
