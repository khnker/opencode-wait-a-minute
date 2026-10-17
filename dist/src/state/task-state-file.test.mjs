import { describe, it, assert } from './test-utils.mjs';
import { before, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { saveTask, loadTask } from './task-store.js';
import {
  loadTaskState,
  saveTaskState,
  reconcileFromDisk,
  aggregatedStatePath,
} from './task-state-file.js';

let root;

before(() => {
  root = fs.mkdtempSync(path.join(tmpdir(), 'wam-agg-'));
});

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('aggregated task-state.json', () => {
  it('is created when a task is saved', () => {
    const taskId = 'task-1';
    saveTask(taskId, {
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, root);

    assert.ok(fs.existsSync(aggregatedStatePath(root)), 'aggregated file must exist');
    const state = loadTaskState(root);
    assert.equal(state.tasks[taskId].status, 'pending');
  });

  it('is reconciled to per-task status when a task completes', () => {
    const taskId = 'task-2';
    saveTask(taskId, {
      id: taskId,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }, root);

    // Simulate completion: update the per-task file via saveTask, which now
    // must also rewrite the aggregated file.
    saveTask(taskId, {
      id: taskId,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }, root);

    const state = loadTaskState(root);
    assert.equal(state.tasks[taskId].status, 'completed',
      'aggregated file must reflect completed status, not stale pending');
  });

  it('corrects drift in the aggregated file on read', () => {
    const taskId = 'task-3';
    saveTask(taskId, {
      id: taskId,
      status: 'completed',
      createdAt: new Date().toISOString(),
    }, root);

    // Manually write a stale aggregated file claiming the task is still pending.
    const stale = {
      version: '1',
      tasks: { [taskId]: { id: taskId, status: 'pending', createdAt: 'x' } },
      lastCheckpoint: null,
    };
    saveTaskState(root, stale);

    // Reading must reconcile from the per-task file (source of truth).
    const state = loadTaskState(root);
    assert.equal(state.tasks[taskId].status, 'completed',
      'loadTaskState must reconcile against the per-task file');
  });

  it('reconcileFromDisk rewrites the aggregated file to match disk', () => {
    const taskId = 'task-4';
    saveTask(taskId, {
      id: taskId,
      status: 'failed',
      createdAt: new Date().toISOString(),
    }, root);

    // Corrupt the aggregated file.
    fs.writeFileSync(aggregatedStatePath(root), JSON.stringify({
      version: '1',
      tasks: {},
      lastCheckpoint: null,
    }));

    const reconciled = reconcileFromDisk(root);
    assert.equal(reconciled.tasks[taskId].status, 'failed');

    // And it must have been persisted to disk.
    const onDisk = JSON.parse(fs.readFileSync(aggregatedStatePath(root), 'utf-8'));
    assert.equal(onDisk.tasks[taskId].status, 'failed');
  });
});
