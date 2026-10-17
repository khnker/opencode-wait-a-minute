/**
 * Task Store — IO operations for task persistence.
 */

import fs from "node:fs";
import path from "node:path";
import { reconcileFromDisk } from "./task-state-file.js";

const TASK_FILE = "task.json";

export function taskFilePath(taskId, root) {
  return path.join(root || process.cwd(), ".wam", "tasks", taskId, TASK_FILE);
}

export function loadTask(taskId, root) {
  const file = taskFilePath(taskId, root);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function saveTask(taskId, state, root) {
  const dir = path.join(root || process.cwd(), ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, TASK_FILE);
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
  // Keep the aggregated `.wam/task-state.json` in sync so the orchestrator
  // can read a consistent view without a separate write path. Reconciliation
  // re-reads the per-task files and overwrites the aggregated file with the
  // reconciled result, so any drift is corrected on every save.
  try {
    reconcileFromDisk(root);
  } catch (err) {
    // Reconciliation is best-effort: a failed aggregate write must not block
    // the per-task write, which is the source of truth.
    if (process.env.WAM_DEBUG) {
      // eslint-disable-next-line no-console
      console.warn(`[wam] aggregated task-state.json reconcile failed: ${err.message}`);
    }
  }
}

export function taskExists(taskId, root) {
  return fs.existsSync(taskFilePath(taskId, root));
}

export function listTasks(root) {
  const dir = path.join(root || process.cwd(), ".wam", "tasks");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
}

export function deleteTask(taskId, root) {
  const dir = path.join(root || process.cwd(), ".wam", "tasks", taskId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
