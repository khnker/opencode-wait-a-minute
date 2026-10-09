import test from 'node:test';
import assert from 'node:assert';
import { normalizeItem, dedupe } from '../../../src/context/cqe-adapter.js';

test('normalizeItem maps raw CQE results to the WAM item contract with provenance', () => {
  const item = normalizeItem({ path: 'src/a.js', line: 3, snippet: 'const x = 1', score: 0.9, type: 'definition' }, 0, 'FIND x', 5);
  assert.strictEqual(item.path, 'src/a.js');
  assert.strictEqual(item.startLine, 3);
  assert.strictEqual(item.content, 'const x = 1');
  assert.strictEqual(item.score, 0.9);
  assert.strictEqual(item.evidenceType, 'definition');
  assert.deepStrictEqual(item.provenance, { operator: 'cqe-retrieval', query: 'FIND x', source: 'cqe', elapsedMs: 5 });
});

test('normalizeItem falls back to safe defaults for sparse raw results', () => {
  const item = normalizeItem({}, 7, 'q', 1);
  assert.strictEqual(item.path, '');
  assert.strictEqual(item.startLine, null);
  assert.strictEqual(item.endLine, null);
  assert.strictEqual(item.score, null);
  assert.strictEqual(item.evidenceType, 'retrieval');
  assert.match(item.id, /unknown:7/);
});

test('dedupe removes repeated path:span:type keeping first occurrence', () => {
  const a = { path: 'a.js', startLine: 1, endLine: 1, evidenceType: 'definition' };
  const b = { path: 'a.js', startLine: 1, endLine: 1, evidenceType: 'definition' };
  const c = { path: 'a.js', startLine: 2, endLine: 2, evidenceType: 'definition' };
  const out = dedupe([a, b, c]);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0], a);
  assert.strictEqual(out[1], c);
});

test('dedupe keeps same span when evidence type differs', () => {
  const a = { path: 'a.js', startLine: 1, endLine: 1, evidenceType: 'definition' };
  const b = { path: 'a.js', startLine: 1, endLine: 1, evidenceType: 'expression' };
  assert.strictEqual(dedupe([a, b]).length, 2);
});
