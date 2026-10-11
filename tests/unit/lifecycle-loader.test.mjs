import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLifecycleInstructions } from '../../src/cognition/lifecycle-loader.js';

test('loadLifecycleInstructions loads explore profile', () => {
  const content = loadLifecycleInstructions('explore');
  assert.ok(content.includes('Exploration & Pre-flight'));
  assert.ok(content.includes('@fast'));
  assert.ok(content.includes('No file writes'));
});

test('loadLifecycleInstructions loads implement profile', () => {
  const content = loadLifecycleInstructions('implement');
  assert.ok(content.includes('Implementation'));
  assert.ok(content.includes('@medium'));
  assert.ok(content.includes('OpenSpec tasks'));
});

test('loadLifecycleInstructions loads validate profile', () => {
  const content = loadLifecycleInstructions('validate');
  assert.ok(content.includes('Validation & Archive'));
  assert.ok(content.includes('@arch-review'));
  assert.ok(content.includes('Verify all tests pass'));
});

test('loadLifecycleInstructions falls back gracefully', () => {
  const content = loadLifecycleInstructions('unknown');
  assert.strictEqual(content, 'Default lifecycle governance active.');
});
