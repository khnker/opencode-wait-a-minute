/**
 * Central resolution of WAM runtime-state paths.
 *
 * `WAM_STATE_DIR` redirects state for real project roots (e.g. the test
 * runner), while roots already under the OS temp directory keep their own
 * `.wam` so per-root fixtures stay isolated from each other.
 */
import os from "node:os";
import path from "node:path";

export function wamStateDir(root) {
  const base = root || process.cwd();
  const override = process.env.WAM_STATE_DIR;
  if (override && !base.startsWith(os.tmpdir())) return path.resolve(override);
  return path.join(base, ".wam");
}

export function tasksDir(root) {
  return path.join(wamStateDir(root), "tasks");
}

export function taskDir(root, taskId) {
  return path.join(tasksDir(root), String(taskId));
}

export function activeTaskPath(root) {
  const file = process.env.WAM_ACTIVE_TASK_FILE;
  if (file) return path.resolve(file);
  return path.join(wamStateDir(root), "active-task");
}

export function sessionTasksDir(root) {
  return path.join(wamStateDir(root), "session-tasks");
}

export function sessionTaskPath(root, sessionId) {
  const safe = String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(sessionTasksDir(root), `${safe}.json`);
}
