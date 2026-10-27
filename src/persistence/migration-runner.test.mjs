import { createMigrationRunner } from './migration-runner.js';
import assert from 'node:assert';
import { test } from 'node:test';

const migrations = [
  { version: 1 },
  { version: 2 },
  { version: 3 }
];
const runner = createMigrationRunner(migrations);

test('migration-runner: run from 0 to 1', async () => {
  const res = await runner.run(0, 1);
  assert.deepStrictEqual(res.applied, [1]);
  assert.deepStrictEqual(res.skipped, [2, 3]);
});

test('migration-runner: run from 1 to 3', async () => {
  const res = await runner.run(1, 3);
  assert.deepStrictEqual(res.applied, [2, 3]);
  assert.deepStrictEqual(res.skipped, [1]);
});

test('migration-runner: no migrations applied', async () => {
  const res = await runner.run(3, 4);
  assert.deepStrictEqual(res.applied, []);
  assert.deepStrictEqual(res.skipped, [1, 2, 3]);
});

test('migration-runner: run empty', async () => {
  const res = await createMigrationRunner([]).run(0, 1);
  assert.deepStrictEqual(res.applied, []);
  assert.deepStrictEqual(res.skipped, []);
});

test('migration-runner: run from -1 to 2', async () => {
  const res = await runner.run(-1, 2);
  assert.deepStrictEqual(res.applied, [1, 2]);
  assert.deepStrictEqual(res.skipped, [3]);
});

test('migration-runner: applies migrations in ascending version order', async () => {
  const calls = [];
  const applied = createMigrationRunner([
    { version: 2, up: () => calls.push(2) },
    { version: 1, up: async () => { await Promise.resolve(); calls.push(1); } },
    { version: 3, apply: () => calls.push(3) },
  ]);
  const res = await applied.run(0, 3);
  assert.deepStrictEqual(res.applied, [1, 2, 3]);
  assert.deepStrictEqual(calls, [1, 2, 3]);
});

test('migration-runner: surfaces migration failures with the version', async () => {
  const failing = createMigrationRunner([
    { version: 1, up: () => { throw new Error('boom'); } },
  ]);
  await assert.rejects(() => failing.run(0, 1), /Migration 1 failed: boom/);
});
