/**
 * test/expansion.test.mjs — deterministic query expansion tests (PRF + identifiers).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIdentifiers, expandQuery } from '../src/expansion.js';
import { ExpansionRetriever } from '../src/retriever.js';
import * as benchmarkModule from '../benchmarks/cqe-benchmark.mjs';

test('splitIdentifiers splits camelCase', () => {
  const terms = splitIdentifiers('getUserById');
  assert.ok(terms.includes('get'));
  assert.ok(terms.includes('user'));
  assert.ok(terms.includes('id'));
});

test('splitIdentifiers splits snake_case', () => {
  const terms = splitIdentifiers('parse_snake_case_name');
  assert.ok(terms.includes('parse'));
  assert.ok(terms.includes('snake'));
  assert.ok(terms.includes('case'));
  assert.ok(terms.includes('name'));
});

test('expandQuery ablates filename queryType', () => {
  const result = expandQuery('find authentication middleware', { cwd: process.cwd(), queryType: 'filename' });
  assert.strictEqual(result.skipped, true);
  assert.deepEqual(result.terms, []);
});

test('expandQuery returns bounded expansion for default queryType', () => {
  const result = expandQuery('find authentication middleware', { cwd: process.cwd() });
  assert.ok(Array.isArray(result.terms));
  assert.ok(result.terms.length <= 5);
  assert.ok(result.expandedQuery.startsWith('find authentication middleware'));
});

test('benchmark registers HE strategy', () => {
  assert.strictEqual(typeof benchmarkModule.runStrategyHybridExpanded, 'function');
  assert.ok(benchmarkModule.STRATEGIES.includes(benchmarkModule.runStrategyHybridExpanded));
});

test('ExpansionRetriever is exported', () => {
  assert.strictEqual(typeof ExpansionRetriever, 'function');
});
