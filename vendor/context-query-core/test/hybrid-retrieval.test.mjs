import test from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
process.env.CQE_CATALOG_DB = path.join(os.tmpdir(), 'cqe-hybrid-' + process.pid + '.db');
import { Retriever, LexicalRetriever, StructuralRetriever, hybridRetrieval, Candidate } from '../src/retriever.js';

test('c) Retriever base no longer throws "not implemented"', () => {
  const r = new Retriever();
  const res = r.retrieve('test query');
  assert.deepStrictEqual(res, []);
  assert.strictEqual(r.name, 'Retriever');
});

test('b) LexicalRetriever.retrieve returns Candidate[] with required fields', async () => {
  const lr = new LexicalRetriever();
  const candidates = await lr.retrieve('retriever');
  assert.ok(Array.isArray(candidates));
  if (candidates.length > 0) {
    const c = candidates[0];
    assert.ok(c instanceof Candidate || typeof c === 'object');
    assert.ok(typeof c.path === 'string');
    assert.ok(typeof c.score === 'number');
    assert.ok(typeof c.source === 'string');
    assert.ok(typeof c.match_type === 'string');
  }
});

test('a) hybridRetrieval returns a non-empty selected set for a query matching real repo files', async () => {
  const retrievers = [new LexicalRetriever(), new StructuralRetriever()];
  const result = await hybridRetrieval(retrievers, 'retriever', { budget: 8000, limit: 10 });
  assert.ok(result);
  assert.ok(Array.isArray(result.selected));
  assert.ok(Array.isArray(result.pool));
  assert.ok(Array.isArray(result.fused));
  assert.strictEqual(typeof result.used, 'number');
  assert.ok(result.selected.length > 0, 'Expected non-empty selected candidates');
});
