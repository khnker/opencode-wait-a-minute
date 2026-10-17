/**
 * Task Status — Single source of truth for task status values.
 * Prevents case-sensitivity bugs and drift between writers/readers.
 */

export const TASK_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
});

export const TASK_STATUS_VALUES = Object.values(TASK_STATUS);

export function normalizeStatus(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return TASK_STATUS_VALUES.includes(v) ? v : null;
}

export function isValidStatus(value) {
  return normalizeStatus(value) !== null;
}

export function countByStatus(tasks) {
  const counts = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  for (const task of Object.values(tasks || {})) {
    const normalized = normalizeStatus(task?.status);
    if (normalized && counts.hasOwnProperty(normalized)) {
      counts[normalized]++;
    }
    counts.total++;
  }

  return counts;
}

export function getNextPendingTask(tasks) {
  if (!tasks) return null;
  const taskIds = Object.keys(tasks).sort();
  for (const taskId of taskIds) {
    if (normalizeStatus(tasks[taskId]?.status) === TASK_STATUS.PENDING) {
      return taskId;
    }
  }
  return null;
}