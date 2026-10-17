/**
 * Task State File — Normalize and validate the persisted `.wam/task-state.json`.
 *
 * This is the state-file model (one file holding many tasks keyed by id), and is
 * deliberately kept separate from the single live-task model in task-state.js.
 * Conflating the two caused writer/reader drift and false-completion reports.
 *
 * Guarantee: every task read from disk has a canonical, lowercased status from
 * TASK_STATUS. Unknown statuses are rejected loudly instead of being silently
 * treated as "not pending" (the root cause of the "all tasks completed" lie).
 */

import fs from "node:fs";
import path from "node:path";
import {
  TASK_STATUS_VALUES,
  normalizeStatus,
  isValidStatus,
} from "./task-status.js";
import { listTasks, loadTask } from "./task-store.js";

const AGGREGATED_FILENAME = "task-state.json";

export function aggregatedStatePath(root) {
  return path.join(root || process.cwd(), ".wam", AGGREGATED_FILENAME);
}

/**
 * Reconcile the aggregated `.wam/task-state.json` with the per-task files on
 * disk under `.wam/tasks/<id>/task.json`. The per-task file is treated as the
 * source of truth (single-writer path), so any drift in the aggregated file is
 * corrected. Returns the normalized, reconciled file state.
 *
 * If the aggregated file is missing, it is reconstructed from disk.
 */
export function loadTaskState(root) {
  const aggPath = aggregatedStatePath(root);
  let fileState = {};
  if (fs.existsSync(aggPath)) {
    try {
      fileState = JSON.parse(fs.readFileSync(aggPath, "utf-8")) || {};
    } catch {
      fileState = {};
    }
  }

  const rawTasks = fileState.tasks || {};
  const tasks = {};

  // The per-task file is the source of truth: only tasks that still exist on
  // disk may live in the reconciled aggregate. Tasks that have been pruned /
  // deleted must not linger in the aggregated file just because a stale entry
  // survives in the previously persisted state.
  const liveIds = new Set(listTasks(root));

  // Start from the aggregated file (preserves any non-status metadata the
  // aggregated writer might carry) for tasks that still exist on disk, then
  // overwrite each with the live per-task file.
  for (const [taskId, task] of Object.entries(rawTasks)) {
    if (!liveIds.has(taskId)) continue;
    const normalized = normalizeTaskFile(taskId, task);
    if (normalized) {
      tasks[taskId] = normalized;
    }
  }

  for (const taskId of listTasks(root)) {
    const live = loadTask(taskId, root);
    if (!live) continue;
    const liveStatus = normalizeStatus(live.status);
    if (!isValidStatus(liveStatus)) {
      // Skip per-task files with an unrecognized status; the per-task file
      // is the source of truth and we do not want to inject bad data into
      // the aggregated view.
      continue;
    }
    tasks[taskId] = {
      ...(tasks[taskId] || {}),
      ...live,
      id: live.id || taskId,
      status: liveStatus,
      createdAt: live.createdAt || tasks[taskId]?.createdAt || new Date().toISOString(),
    };
  }

  return {
    version: fileState.version || "1",
    tasks,
    lastCheckpoint: fileState.lastCheckpoint || null,
  };
}

/**
 * Persist the aggregated `.wam/task-state.json`. Idempotent. Use this as the
 * single writer for the aggregated view; per-task files are written by
 * task-store#saveTask.
 */
export function saveTaskState(root, fileState) {
  const normalized = normalizeStateFile(fileState);
  const aggPath = aggregatedStatePath(root);
  fs.mkdirSync(path.dirname(aggPath), { recursive: true });
  fs.writeFileSync(aggPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

/**
 * Force a re-sync of the aggregated file from disk. Returns the reconciled
 * state and writes it back to disk. Intended for the orchestrator's hot
 * loop so it can never read stale PENDING statuses for completed tasks.
 */
export function reconcileFromDisk(root) {
  const reconciled = loadTaskState(root);
  saveTaskState(root, reconciled);
  return reconciled;
}

export function normalizeTaskFile(taskId, task) {
  if (!task || typeof task !== "object") {
    return null;
  }

  return {
    ...task,
    id: task.id || taskId,
    status: normalizeStatus(task.status),
    validations: Array.isArray(task.validations) ? task.validations : [],
    startedAt: task.startedAt || null,
    completedAt: task.completedAt || null,
    createdAt: task.createdAt || new Date().toISOString(),
  };
}

export function normalizeStateFile(fileState) {
  const state = fileState || {};
  const rawTasks = state.tasks || {};
  const tasks = {};

  for (const [taskId, task] of Object.entries(rawTasks)) {
    const normalized = normalizeTaskFile(taskId, task);
    if (!normalized) {
      throw new Error(`Task ${taskId} is not a valid object.`);
    }
    if (!isValidStatus(normalized.status)) {
      throw new Error(
        `Task ${taskId} has invalid status "${task.status}". ` +
          `Valid values: ${TASK_STATUS_VALUES.join(", ")}.`
      );
    }
    tasks[taskId] = normalized;
  }

  return {
    version: state.version || "1",
    tasks,
    lastCheckpoint: state.lastCheckpoint || null,
  };
}

export function validateStateFile(fileState) {
  if (!fileState || typeof fileState !== "object") {
    return { valid: false, error: "State is not an object" };
  }
  const tasks = fileState.tasks;
  if (!tasks || typeof tasks !== "object") {
    return { valid: false, error: "Missing tasks" };
  }
  const taskIds = Object.keys(tasks);
  if (taskIds.length === 0) {
    return { valid: false, error: "No tasks defined" };
  }
  for (const taskId of taskIds) {
    const status = normalizeStatus(tasks[taskId]?.status);
    if (!status) {
      return {
        valid: false,
        error: `Task ${taskId} has invalid status: "${tasks[taskId]?.status}"`,
      };
    }
    if (!tasks[taskId].createdAt) {
      return { valid: false, error: `Task ${taskId} missing createdAt` };
    }
  }
  return { valid: true };
}
