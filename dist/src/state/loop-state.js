/** Loop state — durable, atomic, replayable persistence for the task loop. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { taskDir as wamTaskDir } from "../shared/wam-paths.js";

export const LOOP_SCHEMA_VERSION = 1;

const LOOP_STATE_FILE = "loop-state.json";
const LOOP_EVENTS_FILE = "loop-events.jsonl";
const LOOP_LOCK_FILE = "loop.lock";
const LOCK_STALE_MS = 30000;
const VALID_STATUS = new Set([
  "RUNNING",
  "COMPLETED",
  "STOPPED",
  "BLOCKED",
  "WAITING_AUTHORIZATION",
  "WAITING_USER",
]);

const TASK_ID_RE = /^[A-Za-z0-9._-]+$/;

export function loopExecutionDir(taskId, root) {
  if (typeof taskId !== "string" || !TASK_ID_RE.test(taskId) || taskId === "." || taskId === "..") {
    throw new Error("loop-state: invalid taskId");
  }
  return path.join(wamTaskDir(root, taskId), "execution");
}

export function loopStatePath(taskId, root) {
  return path.join(loopExecutionDir(taskId, root), LOOP_STATE_FILE);
}

export function loopEventsPath(taskId, root) {
  return path.join(loopExecutionDir(taskId, root), LOOP_EVENTS_FILE);
}

export function loopLockPath(taskId, root) {
  return path.join(loopExecutionDir(taskId, root), LOOP_LOCK_FILE);
}

export function createLoopState({
  taskId,
  sessionId,
  runId,
  maxIterations = 10,
  maxNoProgress = 3,
  now = Date.now(),
} = {}) {
  return {
    schemaVersion: LOOP_SCHEMA_VERSION,
    runId: runId || crypto.randomUUID(),
    taskId,
    sessionId,
    status: "RUNNING",
    iteration: 0,
    maxIterations,
    maxNoProgress,
    startedAt: now,
    updatedAt: now,
    lastTurnId: null,
    lastProgressFingerprint: null,
    consecutiveNoProgress: 0,
    stopReason: null,
    sequence: 0,
    lastDecision: null,
  };
}

export function validateLoopState(state) {
  if (!state || typeof state !== "object") throw new Error("loop-state: snapshot required");
  if (state.schemaVersion !== LOOP_SCHEMA_VERSION) throw new Error("loop-state: unsupported schemaVersion");
  if (typeof state.runId !== "string" || state.runId.length === 0) throw new Error("loop-state: runId required");
  if (typeof state.taskId !== "string" || state.taskId.length === 0) throw new Error("loop-state: taskId required");
  if (!VALID_STATUS.has(state.status)) throw new Error(`loop-state: invalid status ${JSON.stringify(state.status)}`);
  if (!Number.isFinite(state.iteration)) throw new Error("loop-state: iteration must be finite");
  if (!Number.isFinite(state.startedAt)) throw new Error("loop-state: startedAt must be finite");
  if (!Number.isFinite(state.updatedAt)) throw new Error("loop-state: updatedAt must be finite");
  return state;
}

export function applyLoopDecision(state, result, { turnId = state.lastTurnId, now = Date.now() } = {}) {
  const checkpoint = result.checkpoint || {};
  return {
    ...state,
    iteration: checkpoint.iteration ?? state.iteration,
    consecutiveNoProgress: checkpoint.consecutiveNoProgress ?? state.consecutiveNoProgress,
    lastProgressFingerprint: checkpoint.lastProgressFingerprint ?? null,
    status: checkpoint.status || state.status,
    stopReason: result.stopReason ?? null,
    lastDecision: result.decision,
    lastTurnId: turnId,
    updatedAt: now,
  };
}

function readSnapshot(taskId, root) {
  const file = loopStatePath(taskId, root);
  if (!fs.existsSync(file)) return { state: null, corrupt: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    validateLoopState(parsed);
    return { state: parsed, corrupt: false };
  } catch {
    return { state: null, corrupt: true };
  }
}

export function loadLoopState(taskId, root) {
  return readSnapshot(taskId, root);
}

export function saveLoopState(taskId, root, state) {
  validateLoopState(state);
  const dir = loopExecutionDir(taskId, root);
  fs.mkdirSync(dir, { recursive: true });
  const file = loopStatePath(taskId, root);
  if (fs.existsSync(file)) {
    const existing = readSnapshot(taskId, root);
    if (existing.corrupt) {
      fs.renameSync(file, path.join(dir, `loop-state.corrupt-${Date.now()}.json`));
    }
  }
  const tmp = path.join(dir, `${LOOP_STATE_FILE}.tmp-${process.pid}-${crypto.randomUUID()}`);
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return state;
}

export function readLoopEvents(taskId, root) {
  const file = loopEventsPath(taskId, root);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const events = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return events;
}

export function appendLoopEvent(taskId, root, event) {
  if (!event || typeof event.eventId !== "string" || typeof event.type !== "string") {
    throw new TypeError("loop-state: event requires eventId and type");
  }
  const dir = loopExecutionDir(taskId, root);
  fs.mkdirSync(dir, { recursive: true });
  const events = readLoopEvents(taskId, root);
  if (events.some((e) => e.eventId === event.eventId)) return { added: false, event: null };
  const lastSeq = events.reduce((max, e) => (Number.isFinite(e.seq) && e.seq > max ? e.seq : max), 0);
  const stored = { ...event, seq: lastSeq + 1 };
  fs.appendFileSync(loopEventsPath(taskId, root), `${JSON.stringify(stored)}\n`);
  return { added: true, event: stored };
}

export function reduceLoopEvents(base, events) {
  let state = base;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const candidate = event.state;
    try {
      validateLoopState(candidate);
      state = candidate;
    } catch {
      continue;
    }
  }
  return state;
}

export function recoverLoopState(taskId, root) {
  const snapshot = loadLoopState(taskId, root);
  const events = readLoopEvents(taskId, root);
  const after = snapshot.state?.sequence || 0;
  const newer = events.filter((e) => Number.isFinite(e.seq) && e.seq > after);
  const state = reduceLoopEvents(snapshot.state, newer);
  return { state, corrupt: snapshot.corrupt, replayed: newer.length };
}

export function recordLoopDecision(taskId, root, state, result, { eventId, turnId, now = Date.now(), quality = null } = {}) {
  const appended = appendLoopEvent(taskId, root, {
    type: "decision",
    runId: state.runId,
    eventId: eventId || `${state.runId}:${state.sequence + 1}`,
    at: now,
    decision: result.decision,
    ...(quality ? { quality } : {}),
    state,
  });
  const saved = { ...state };
  if (appended.added) saved.sequence = appended.event.seq;
  if (turnId !== undefined && turnId !== null) saved.lastTurnId = turnId;
  saved.updatedAt = now;
  saveLoopState(taskId, root, saved);
  return { state: saved, appended: appended.added };
}

export function withLoopLock(taskId, root, fn) {
  const dir = loopExecutionDir(taskId, root);
  fs.mkdirSync(dir, { recursive: true });
  const lock = loopLockPath(taskId, root);

  const acquire = () => fs.openSync(lock, "wx");
  let fd;
  try {
    fd = acquire();
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
    let stale = false;
    try {
      stale = Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS;
    } catch {
      stale = false;
    }
    if (!stale) throw new Error("loop-state: lock held");
    fs.rmSync(lock, { force: true });
    fd = acquire();
  }

  try {
    fs.writeSync(fd, String(process.pid));
    return fn();
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      /* already closed */
    }
    fs.rmSync(lock, { force: true });
  }
}
