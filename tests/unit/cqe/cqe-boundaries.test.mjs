import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

test('BM25 default index lives under ~/.cache/cqe, not the package', async () => {
  const { INDEX_FILE } = await import('../../../vendor/context-query-core/src/bm25.js');
  const prev = process.env.CF_BM25_INDEX_FILE;
  delete process.env.CF_BM25_INDEX_FILE;
  try {
    assert.equal(INDEX_FILE(), path.join(os.homedir(), '.cache', 'cqe', 'bm25-index.json'));
  } finally {
    if (prev === undefined) delete process.env.CF_BM25_INDEX_FILE;
    else process.env.CF_BM25_INDEX_FILE = prev;
  }
});

test('CF_BM25_INDEX_FILE keeps priority over the default cache path', async () => {
  const { INDEX_FILE } = await import('../../../vendor/context-query-core/src/bm25.js');
  const prev = process.env.CF_BM25_INDEX_FILE;
  process.env.CF_BM25_INDEX_FILE = '/tmp/custom-bm25.json';
  try {
    assert.equal(INDEX_FILE(), '/tmp/custom-bm25.json');
  } finally {
    if (prev === undefined) delete process.env.CF_BM25_INDEX_FILE;
    else process.env.CF_BM25_INDEX_FILE = prev;
  }
});

test('fatal worker branch drops the cached handle and terminates', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/context/cqe-adapter.js'), 'utf8');
  const start = src.indexOf("msg.type === 'fatal'");
  assert.notEqual(start, -1);
  const branch = src.slice(start, start + 400);
  assert.match(branch, /handleCache\.delete\(key\)/);
  assert.match(branch, /worker\.terminate\(\)/);
});

test('build copies vendor so the dist worker resolves its imports', () => {
  const build = fs.readFileSync(path.join(ROOT, 'scripts/build.mjs'), 'utf8');
  assert.match(build, /dirsToCopy\s*=\s*\[[^\]]*'vendor'[^\]]*\]/);
});
