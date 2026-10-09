import { describe, it, assert } from './test-utils.mjs';
import { createWamState, saveWamState, loadWamState } from './wam-state.js';
import { StateValidator } from '../persistence/state-validator.js';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

describe('StateValidator', () => {
  it('validates a valid state', () => {
    const state = createWamState('test-task-123');
    StateValidator.validate(state);
    assert.ok(true);
  });

  it('throws error for missing taskId', () => {
    const state = createWamState('');
    assert.throws(() => StateValidator.validate(state), /missing taskId/);
  });

  it('accepts undefined status', () => {
    const state = createWamState('test-task-456');
    delete state.status;
    StateValidator.validate(state);
    assert.ok(true);
  });

  it('processes IN_PROGRESS task older than 1 hour', async () => {
    const state = createWamState('old-task-789');
    state.status = 'IN_PROGRESS';
    state.updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const processed = StateValidator.processState(state);

    assert.equal(processed.status, 'ORPHANED_RECOVERY');
    assert.match(processed.recoveryReason, /Timeout/);
  });

  it('leaves recent IN_PROGRESS tasks unchanged', () => {
    const state = createWamState('recent-task-999');
    state.status = 'IN_PROGRESS';
    state.updatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const processed = StateValidator.processState(state);

    assert.equal(processed.status, 'IN_PROGRESS');
    assert.equal(processed.recoveryReason, undefined);
  });
});

describe('saveWamState with StateValidator', () => {
  it('saves valid state successfully', async () => {
    const tempDir = await tmpdir();
    const testDir = path.join(tempDir, 'test-save-wam');

    const state = createWamState('test-task-001');
    const filePath = await saveWamState('test-task-001', state, testDir);

    assert.match(filePath, /test-task-001/);

    const savedState = JSON.parse(await readFile(filePath, 'utf8'));
    assert.equal(savedState.taskId, 'test-task-001');
    assert.equal(savedState.status, 'active');
  });

  it('throws on invalid state during save', async () => {
    const tempDir = await tmpdir();
    const testDir = path.join(tempDir, 'test-invalid-save');

    const invalidState = { taskId: 'bad-task', status: null };

    await assert.rejects(
      saveWamState('bad-task', invalidState, testDir),
      /missing status/
    );
  });
});

describe('loadWamState with StateValidator', () => {
  it('loads state and processes health checks', async () => {
    const tempDir = await tmpdir();
    const testDir = path.join(tempDir, 'test-load-wam');
    await mkdir(path.join(testDir, 'load-task-111'), { recursive: true });

    const state = createWamState('load-task-111');
    state.status = 'IN_PROGRESS';
    state.updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const filePath = path.join(testDir, 'load-task-111', 'wam-state.json');
    await writeFile(filePath, JSON.stringify(state, null, 2));

    const loaded = await loadWamState('load-task-111', testDir);

    assert.equal(loaded.taskId, 'load-task-111');
    assert.equal(loaded.status, 'ORPHANED_RECOVERY');
    assert.match(loaded.recoveryReason, /Timeout/);
  });
});
