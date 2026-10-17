/**
 * retention-manager.js — Pruning and archival of WAM tasks.
 *
 * Implements the retention policy for `.wam/tasks/<id>/`:
 *  - Identifies tasks whose status is `completed` AND whose last update /
 *    completion timestamp is older than `WAM_RETENTION_TTL_DAYS` (15 days).
 *  - Centralizes a compact evidence/summary into `.wam/archive/tasks/<id>-<isoDate>/`
 *    so important context is preserved outside the bulky per-task directory.
 *  - Removes the bulky per-task directory and re-reconciles `.wam/task-state.json`
 *    so the aggregated state store stays consistent with disk.
 *
 * Design notes:
 *  - The per-task `task.json` file is the source of truth; we never infer status
 *    from filesystem mtimes alone (which can be skewed by tooling).
 *  - "Last update" is read from `updatedAt`, falling back to `completedAt`,
 *    then to `createdAt`. Anything else means the task is too young to prune.
 *  - Archival is best-effort: a failed archive never blocks pruning (a corrupt
 *    bulky directory should not leak), but a failed prune is reported and
 *    leaves the archive copy in place for inspection.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { listTasks, loadTask } from "../state/task-store.js";
import { reconcileFromDisk } from "../state/task-state-file.js";
import { TASK_STATUS } from "../state/task-status.js";

export const WAM_RETENTION_TTL_DAYS = 15;
export const WAM_ARCHIVE_DIRNAME = "archive";

/**
 * Resolve the per-task timestamp (ms epoch) used to decide whether a task
 * is past its retention window. Order of preference: updatedAt > completedAt
 * > createdAt. Returns `null` if no timestamp is present (the task is then
 * treated as too young to prune to avoid accidental data loss).
 */
export function resolveTaskTimestamp(taskState) {
  if (!taskState || typeof taskState !== "object") return null;
  const candidates = [taskState.updatedAt, taskState.completedAt, taskState.createdAt];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Build the compact summary that is preserved in the archive. It deliberately
 * drops bulky fields (e.g. raw transcripts, large evidence blobs) and keeps
 * the metadata that is useful for historical inspection.
 */
export function buildArchiveSummary(taskId, taskState, extra = {}) {
  const summary = {
    taskId,
    archivedAt: new Date().toISOString(),
    status: taskState?.status ?? null,
    title: taskState?.title ?? null,
    kind: taskState?.kind ?? null,
    createdAt: taskState?.createdAt ?? null,
    updatedAt: taskState?.updatedAt ?? null,
    completedAt: taskState?.completedAt ?? null,
    summary: taskState?.summary ?? null,
    outcome: taskState?.outcome ?? null,
    evidence: Array.isArray(taskState?.evidence)
      ? taskState.evidence.map((e) => ({
          kind: e?.kind ?? null,
          source: e?.source ?? null,
          verdict: e?.verdict ?? null,
          note: e?.note ?? null,
        }))
      : [],
    artifacts: Array.isArray(taskState?.artifacts)
      ? taskState.artifacts.slice()
      : [],
  };
  if (extra && extra.prunedAt) summary.prunedAt = extra.prunedAt;
  if (extra && extra.ttlDays != null) summary.ttlDays = extra.ttlDays;
  return summary;
}

/**
 * Resolve the absolute path of the archive directory for a given task.
 * Layout: `<root>/.wam/archive/tasks/<taskId>-<isoDate>/`.
 */
export function archiveDirFor(root, taskId, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return path.join(
    root || process.cwd(),
    ".wam",
    WAM_ARCHIVE_DIRNAME,
    "tasks",
    `${taskId}-${stamp}`,
  );
}

/**
 * Write the archive summary for a single task. Returns the absolute path of
 * the archive directory on success. The directory is created if missing.
 */
export async function archiveTask(root, taskId, taskState, options = {}) {
  const ttlDays = options.ttlDays ?? WAM_RETENTION_TTL_DAYS;
  const now = options.now instanceof Date ? options.now : new Date();
  const dir = archiveDirFor(root, taskId, now);
  await fsp.mkdir(dir, { recursive: true });
  const summary = buildArchiveSummary(taskId, taskState, {
    prunedAt: now.toISOString(),
    ttlDays,
  });
  await fsp.writeFile(
    path.join(dir, "task-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8",
  );
  return dir;
}

/**
 * Decide whether a task is eligible for pruning right now.
 * Returns `{ eligible: boolean, reason: string, ageMs: number|null }`.
 */
export function isEligibleForPrune(taskState, options = {}) {
  const ttlDays = options.ttlDays ?? WAM_RETENTION_TTL_DAYS;
  const now = typeof options.now === "number" ? options.now : Date.now();
  if (!taskState) {
    return { eligible: false, reason: "missing-state", ageMs: null };
  }
  if (normalizeStatus(taskState.status) !== TASK_STATUS.COMPLETED) {
    return { eligible: false, reason: `status:${taskState.status ?? "unknown"}`, ageMs: null };
  }
  const ts = resolveTaskTimestamp(taskState);
  if (ts == null) {
    return { eligible: false, reason: "no-timestamp", ageMs: null };
  }
  const ageMs = now - ts;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  if (ageMs <= ttlMs) {
    return { eligible: false, reason: "within-ttl", ageMs };
  }
  return { eligible: true, reason: "ttl-expired", ageMs };
}

function normalizeStatus(value) {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

/**
 * Prune completed tasks whose last update is older than `ttlDays`.
 * Returns a structured report:
 *   {
 *     pruned:    [{ taskId, archiveDir, ageMs }],
 *     archived:  [{ taskId, archiveDir }],
 *     skipped:   [{ taskId, reason }],
 *     errors:    [{ taskId, error }],
 *     ttlDays:   number,
 *   }
 *
 * The aggregated `.wam/task-state.json` is reconciled once at the end so the
 * state store reflects the new on-disk reality.
 */
export async function pruneCompletedTasks(root, options = {}) {
  const ttlDays = options.ttlDays ?? WAM_RETENTION_TTL_DAYS;
  const nowMs = typeof options.now === "number" ? options.now : Date.now();
  const nowDate = new Date(nowMs);

  const report = {
    pruned: [],
    archived: [],
    skipped: [],
    errors: [],
    ttlDays,
  };

  const taskIds = listTasks(root);
  for (const taskId of taskIds) {
    let taskState = null;
    try {
      taskState = loadTask(taskId, root);
    } catch (err) {
      report.errors.push({ taskId, error: err?.message ?? String(err) });
      continue;
    }

    const decision = isEligibleForPrune(taskState, { ttlDays, now: nowMs });
    if (!decision.eligible) {
      report.skipped.push({ taskId, reason: decision.reason });
      continue;
    }

    let archiveDir = null;
    try {
      archiveDir = await archiveTask(root, taskId, taskState, {
        ttlDays,
        now: nowDate,
      });
      report.archived.push({ taskId, archiveDir });
    } catch (err) {
      report.errors.push({ taskId, error: `archive: ${err?.message ?? err}` });
      continue;
    }

    const taskDir = path.join(root || process.cwd(), ".wam", "tasks", taskId);
    try {
      await fsp.rm(taskDir, { recursive: true, force: true });
      report.pruned.push({ taskId, archiveDir, ageMs: decision.ageMs });
    } catch (err) {
      report.errors.push({ taskId, error: `remove: ${err?.message ?? err}` });
    }
  }

  // Reconcile the aggregated state file once at the end so it reflects the
  // pruned reality. We do not let a reconcile failure abort the report.
  try {
    reconcileFromDisk(root);
  } catch (err) {
    report.errors.push({ taskId: null, error: `reconcile: ${err?.message ?? err}` });
  }

  return report;
}

/**
 * Archive and prune a single completed task immediately.
 *
 * Archives the task's compact summary to `.wam/archive/tasks/<taskId>-<iso>/`,
 * removes the bulky per-task directory from `.wam/tasks/<taskId>/`, and
 * re-reconciles `.wam/task-state.json` so the aggregated store reflects the
 * new on-disk reality.
 *
 * This is the immediate counterpart to `pruneCompletedTasks` (which is the
 * time-windowed bulk sweep). It is invoked synchronously by the task
 * lifecycle layer when a task reaches the DONE phase, so completed tasks do
 * not linger in `.wam/tasks/`.
 *
 * Best-effort: a failed archive never blocks the prune (a corrupt bulky
 * directory should not leak), but a failed prune is reported and leaves the
 * archive copy in place for inspection.
 *
 * @param {string} taskId
 * @param {string} root  project root (defaults to cwd)
 * @returns {Promise<{ archived: boolean, archiveDir: string|null, pruned: boolean, errors: string[] }>}
 */
export async function archiveAndPruneSingleTask(taskId, root) {
  const result = { archived: false, archiveDir: null, pruned: false, errors: [] };
  const taskState = loadTask(taskId, root);
  if (!taskState) {
    result.errors.push(`task ${taskId} not found on disk`);
    return result;
  }

  // Archive first — preserve the summary even if the bulky directory is
  // somehow unremovable.
  try {
    const archiveDir = await archiveTask(root, taskId, taskState, {
      ttlDays: WAM_RETENTION_TTL_DAYS,
      now: new Date(),
    });
    result.archived = true;
    result.archiveDir = archiveDir;
  } catch (err) {
    const msg = err?.message ?? String(err);
    result.errors.push(`archive: ${msg}`);
    // Best-effort: do not block pruning on a failed archive.
  }

  const taskDir = path.join(root || process.cwd(), ".wam", "tasks", taskId);
  try {
    await fsp.rm(taskDir, { recursive: true, force: true });
    result.pruned = true;
  } catch (err) {
    const msg = err?.message ?? String(err);
    result.errors.push(`remove: ${msg}`);
  }

  // Re-reconcile the aggregated state file so it reflects the removal.
  try {
    reconcileFromDisk(root);
  } catch (err) {
    result.errors.push(`reconcile: ${err?.message ?? err}`);
  }

  return result;
}

/**
 * Backwards-compatible sync entry point. The original `purgeTasks` signature
 * is preserved (it only took a directory) but it now delegates to the async
 * `pruneCompletedTasks` with the default TTL.
 */
export function purgeTasks(tasksRootDir) {
  // tasksRootDir historically pointed at `.wam/tasks/`. We accept both that
  // legacy form and a project root, and derive the project root when needed.
  const root = inferRootFromTasksDir(tasksRootDir);
  // Fire-and-forget: callers that need the report should call
  // `pruneCompletedTasks` directly. The returned promise is intentionally
  // not awaited so existing call sites keep working.
  pruneCompletedTasks(root).catch(() => {});
}

function inferRootFromTasksDir(tasksRootDir) {
  if (!tasksRootDir) return process.cwd();
  const normalized = path.resolve(tasksRootDir);
  // Legacy form: `<root>/.wam/tasks`
  if (path.basename(normalized) === "tasks" && path.basename(path.dirname(normalized)) === ".wam") {
    return path.dirname(path.dirname(normalized));
  }
  return normalized;
}

// Re-export for tests that want the sync entry point's derived root.
export const _internal = { inferRootFromTasksDir };

// Touch `fs` to keep the import live in environments where sync APIs are
// stubbed out (matches the dual sync/async pattern used in task-store.js).
void fs;
