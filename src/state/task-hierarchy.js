/**
 * Task Hierarchy — explicit project → group → task → session links.
 *
 * Hierarchy is stored as optional fields on the existing task.json record so
 * legacy tasks keep working unchanged. One module owns validation, ancestry,
 * inherited constraints and consolidation; it never writes the project base.
 */

import { CONTEXT_SCOPE_TYPES } from "../context/context-normalization.js";
import { listTasks, loadTask, saveTask } from "./task-store.js";

export const TASK_SCOPES = CONTEXT_SCOPE_TYPES;

const LEVELS = TASK_SCOPES;
const CONSOLIDATED_CAP = 20;

function toTaskMap(tasks) {
  const map = new Map();
  if (!tasks) return map;
  if (tasks instanceof Map) {
    for (const [id, task] of tasks) if (task) map.set(task.taskId || id, task);
    return map;
  }
  if (Array.isArray(tasks)) {
    for (const task of tasks) if (task && task.taskId) map.set(task.taskId, task);
    return map;
  }
  if (typeof tasks === "object") {
    for (const [id, task] of Object.entries(tasks)) {
      if (task) map.set(task.taskId || id, task);
    }
  }
  return map;
}

function loadTaskMap(root) {
  const map = new Map();
  for (const taskId of listTasks(root)) {
    const task = loadTask(taskId, root);
    if (task) map.set(task.taskId || taskId, task);
  }
  return map;
}

function scopeOf(task) {
  if (task && TASK_SCOPES.includes(task.scope)) return task.scope;
  // Legacy records carry no scope: a root is a project, a linked task is a task.
  return task && task.parentId ? "task" : "project";
}

function countDone(requirements) {
  if (!Array.isArray(requirements)) return 0;
  return requirements.filter((req) => req && (
    req.done === true ||
    ["done", "completed", "verified", "accepted"].includes(req.status)
  )).length;
}

function constraintKey(constraint) {
  return typeof constraint === "string" ? constraint : JSON.stringify(constraint);
}

/**
 * Validate a proposed parent link against the supplied task collection.
 * Never throws; a task without a parent is a valid root.
 */
export function validateTaskLink(tasks, { taskId, parentId } = {}) {
  try {
    const map = toTaskMap(tasks);
    const errors = [];

    if (typeof taskId !== "string" || !taskId.trim()) {
      return { ok: false, errors: ["taskId must be a non-empty string"] };
    }
    const child = map.get(taskId);
    if (!child) errors.push(`task ${taskId} not found`);

    if (parentId == null) return { ok: errors.length === 0, errors };
    if (typeof parentId !== "string" || !parentId.trim()) {
      return { ok: false, errors: ["parentId must be a non-empty string"] };
    }
    if (parentId === taskId) {
      errors.push("task cannot be its own parent");
      return { ok: false, errors };
    }

    const parent = map.get(parentId);
    if (!parent) {
      errors.push(`parent task ${parentId} not found`);
      return { ok: false, errors };
    }

    const seen = new Set([taskId]);
    let cursor = parent;
    while (cursor && cursor.parentId) {
      if (seen.has(cursor.parentId)) {
        errors.push("cycle detected in task hierarchy");
        break;
      }
      seen.add(cursor.parentId);
      cursor = map.get(cursor.parentId);
    }

    if (child && errors.length === 0) {
      const childLevel = LEVELS.indexOf(scopeOf(child));
      const parentLevel = LEVELS.indexOf(scopeOf(parent));
      if (parentLevel >= childLevel) {
        errors.push(
          `invalid level ordering: ${scopeOf(parent)} cannot be parent of ${scopeOf(child)}`
        );
      }
    }

    return { ok: errors.length === 0, errors };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

/** Validate then persist the link through the existing atomic task store. */
export function setTaskParent(root, taskId, parentId) {
  try {
    const child = loadTask(taskId, root);
    if (!child) return { ok: false, errors: [`task ${taskId} not found`] };

    const map = loadTaskMap(root);
    map.set(taskId, child);
    const result = validateTaskLink(map, { taskId, parentId });
    if (!result.ok) return result;

    saveTask(taskId, {
      ...child,
      parentId: parentId ?? null,
      updatedAt: Date.now(),
    }, root);
    return { ok: true, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

/** Ordered root→leaf chain, including the task itself; [] when absent/cyclic. */
export function getAncestry(root, taskId) {
  const map = loadTaskMap(root);
  const chain = [];
  const seen = new Set();
  let cursor = map.get(taskId);

  while (cursor && !seen.has(cursor.taskId)) {
    seen.add(cursor.taskId);
    chain.unshift(cursor);
    cursor = cursor.parentId ? map.get(cursor.parentId) : null;
  }
  if (cursor && seen.has(cursor.taskId)) return [];
  return chain;
}

/** Constraints inherited from project/group ancestors only, deduped. */
export function getApplicableConstraints(root, taskId) {
  const constraints = [];
  const seen = new Set();

  for (const task of getAncestry(root, taskId)) {
    if (task.taskId === taskId) continue;
    const scope = scopeOf(task);
    if (scope !== "project" && scope !== "group") continue;
    const own = Array.isArray(task.constraints) ? task.constraints : [];
    for (const constraint of own) {
      const key = constraintKey(constraint);
      if (seen.has(key)) continue;
      seen.add(key);
      constraints.push(constraint);
    }
  }
  return constraints;
}

/**
 * Append a bounded, deduped summary of a child task to its parent group.
 * Idempotent for the same taskId + source updatedAt; never writes the base.
 */
export function consolidateTaskToGroup(root, taskId) {
  try {
    const child = loadTask(taskId, root);
    if (!child) return { ok: false, errors: [`task ${taskId} not found`] };
    if (!child.parentId) {
      return { ok: false, errors: [`task ${taskId} has no parent group`] };
    }

    const parent = loadTask(child.parentId, root);
    if (!parent) {
      return { ok: false, errors: [`parent task ${child.parentId} not found`] };
    }
    if (scopeOf(parent) !== "group") {
      return { ok: false, errors: [`parent task ${child.parentId} is not a group`] };
    }

    const existing = Array.isArray(parent.consolidated) ? parent.consolidated : [];
    const prior = existing.find((entry) => entry && entry.taskId === taskId);
    const sourceUpdatedAt = child.updatedAt ?? null;
    if (prior && prior.sourceUpdatedAt === sourceUpdatedAt) {
      return { ok: true, changed: false, entry: prior, count: existing.length };
    }

    const entry = {
      taskId,
      requirementsDone: countDone(child.requirements),
      nextAction: child.nextAction ?? null,
      at: new Date().toISOString(),
      sourceUpdatedAt,
    };
    const next = existing.filter((item) => !item || item.taskId !== taskId);
    next.push(entry);
    const bounded = next.slice(-CONSOLIDATED_CAP);

    saveTask(parent.taskId, {
      ...parent,
      consolidated: bounded,
      updatedAt: Date.now(),
    }, root);
    return { ok: true, changed: true, entry, count: bounded.length };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

/** Resolve the effective scope and owning ids from the task ancestry. */
export function getTaskScope(root, taskId) {
  const ancestry = getAncestry(root, taskId);
  if (ancestry.length === 0) return null;

  const self = ancestry[ancestry.length - 1];
  const projectId = ancestry[0].taskId;
  let groupId = null;
  let sessionId = null;

  for (const task of ancestry) {
    const scope = scopeOf(task);
    if (scope === "group") groupId = task.taskId;
    if (scope === "session") sessionId = task.sessionId || task.taskId;
  }

  return { scope: scopeOf(self), projectId, groupId, sessionId };
}
