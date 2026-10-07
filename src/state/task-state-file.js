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

import {
  TASK_STATUS_VALUES,
  normalizeStatus,
  isValidStatus,
} from "./task-status.js";

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
