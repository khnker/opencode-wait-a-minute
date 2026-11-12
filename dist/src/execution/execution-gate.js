import { classifyBashMutation } from "./shell-mutation.js";

const MUTATING_TOOLS = new Set([
  "write",
  "edit",
  "patch",
  "multiedit",
  "apply_patch",
  "applypatch",
  "str_replace_editor",
]);

export function isMutatingToolCall(tool, args = {}) {
  const name = String(tool || "").toLowerCase();
  if (MUTATING_TOOLS.has(name)) return true;
  if (name === "bash" || name === "sh") {
    const command = String(args?.command ?? args?.cmd ?? "");
    return classifyBashMutation(command).mutating;
  }
  return false;
}

export function isExecutionGateActive(task) {
  return task?.executionGate?.active === true;
}

export function shouldClearExecutionGate(task, taskInFlight = false) {
  return isExecutionGateActive(task) && taskInFlight !== true;
}

// Agent passes are in-memory: a gate written by another process cannot be
// guarded by this one, so it must be treated as stale instead of blocking
// every mutation forever after a restart. Gates without ownerPid predate this
// marker and are also stale.
const DEFAULT_EXECUTION_GATE_TTL_MS = 30 * 60 * 1000;

function executionGateTtlMs() {
  const raw = Number(process.env.WAM_EXECUTION_GATE_TTL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EXECUTION_GATE_TTL_MS;
}

function parseGateTimestamp(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isExecutionGateStale(gate, currentPid = process.pid) {
  if (gate?.active !== true) return false;
  const ownerPid = gate?.ownerPid;
  if (!Number.isInteger(ownerPid)) return true;
  if (ownerPid !== currentPid) return true;
  // A same-pid gate can still be orphaned (its pass aborted before the
  // `finally` ran), so bound its lifetime instead of trusting the pid alone.
  // Missing or malformed timestamps fail open: a stuck gate must never brick
  // the session.
  const startedAt = parseGateTimestamp(gate?.startedAt);
  if (startedAt === null) return true;
  return Date.now() - startedAt > executionGateTtlMs();
}

// A gate is orphaned when its owning loop reached a terminal state but no
// agent pass is in flight: the in-memory pass that could clear it in `finally`
// is gone (e.g. the pass was aborted). Same-process gates would otherwise keep
// blocking mutations for the rest of the turn after STOP_STAGNATION/COMPLETED.
export function shouldReleaseOrphanGate(task, { loopStatus = null, inFlight = false } = {}) {
  if (!isExecutionGateActive(task)) return false;
  if (inFlight) return false;
  return loopStatus === "STOPPED" || loopStatus === "COMPLETED";
}
