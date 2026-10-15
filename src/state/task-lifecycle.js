/**
 * Task Lifecycle — Task state transitions (Create, Resume, Switch, Pause, Complete, Block).
 */

import { loadTask, saveTask, taskExists, deleteTask } from "./task-store.js";
import { createState, normalizeState, validateState } from "./task-state.js";
import { archiveAndPruneSingleTask } from "../persistence/retention-manager.js";

const TERMINAL_PHASES = new Set(["DONE"]);

export function create(taskId, root) {
  if (taskExists(taskId, root)) {
    throw new Error(`Task ${taskId} already exists`);
  }
  const state = createState(taskId);
  saveTask(taskId, state, root);
  return state;
}

export function resume(taskId, root) {
  const state = loadTask(taskId, root);
  if (!state) {
    throw new Error(`Task ${taskId} not found`);
  }
  return normalizeState(state);
}

export function switchTo(taskId, newPhase, root) {
  const state = loadTask(taskId, root);
  if (!state) throw new Error(`Task ${taskId} not found`);

  if (TERMINAL_PHASES.has(state.phase) && newPhase !== state.phase) {
    throw new Error(`cannot transition from terminal phase ${state.phase}`);
  }

  // ponytail: low-level transition only. The authoritative completion gate
  // lives in src/integration/orchestration.js and is applied at the integration
  // layer (message-handler / index), not here.
  state.phase = newPhase;
  state.updatedAt = Date.now();
  saveTask(taskId, state, root);

  // When the task reaches the DONE terminal phase, immediately archive it
  // out of `.wam/tasks/` so completed tasks do not linger there. This is
  // fire-and-forget: the per-task file (source of truth) is already saved,
  // and a failed archive/prune must never throw out of the lifecycle.
  if (newPhase === "DONE") {
    archiveAndPruneSingleTask(taskId, root).catch((err) => {
      if (process.env.WAM_DEBUG) {
        // eslint-disable-next-line no-console
        console.warn(
          `[wam] archive/prune failed for task ${taskId}: ${err?.message ?? err}`,
        );
      }
    });
  }

  return state;
}

export function pause(taskId, root) {
  return switchTo(taskId, "WAITING", root);
}

export function complete(taskId, root) {
  return switchTo(taskId, "DONE", root);
}

export function block(taskId, reason, root) {
  const state = loadTask(taskId, root);
  if (!state) throw new Error(`Task ${taskId} not found`);
  
  state.blocked = reason;
  state.updatedAt = Date.now();
  saveTask(taskId, state, root);
  return state;
}

export { createState, normalizeState, validateState };
