import test from 'node:test';
import assert from 'node:assert';
import { shouldSearch } from '../../../benchmarks/retrieval/delegation-policy.mjs';

test('delegation - shouldSearch for symbol location task', () => {
  const task = { text: 'Where is retrieveWithCqe defined?', context: 'I need to find the source code location' };
  const result = shouldSearch(task);
  assert.strictEqual(result.search, true);
});

test('delegation - shouldSearch for reasoning-only task', () => {
  const task = { text: 'Please reason about the implications of this change', context: 'Abstract analysis' };
  const result = shouldSearch(task);
  assert.strictEqual(result.search, false);
});

test('delegation - shouldSearch for contradiction detection task', () => {
  const task = { text: 'Detect if there are contradictions between these two statements', context: 'statement1, statement2' };
  const result = shouldSearch(task);
  assert.strictEqual(result.search, true);
});

test('delegation - shouldSearch for abstract reasoning without repository terms', () => {
  const task = { text: 'Analyze the overall system architecture', context: 'High-level design discussion' };
  const result = shouldSearch(task);
  assert.strictEqual(result.search, false);
});
