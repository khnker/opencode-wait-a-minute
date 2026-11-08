const MUTATING_TOOLS = new Set([
  "write",
  "edit",
  "patch",
  "multiedit",
  "apply_patch",
  "applypatch",
  "str_replace_editor",
]);

const BASH_MUTATION_RE = /(^|[;&|]\s*)(rm|mv|cp|touch|mkdir|rmdir|chmod|chown|ln|dd|sed\s+-i|perl\s+-pi|tee|truncate|git\s+(apply|commit|checkout|reset|clean|merge|rebase|push|stash\s+(push|pop|apply))|npm\s+(i|install|ci|uninstall|update|add|remove)|pnpm\s+(i|install|add|remove|update)|yarn\s+(install|add|remove|upgrade)|pip3?\s+(install|uninstall)|poetry\s+(add|remove|install)|cargo\s+(add|remove|install)|go\s+(get|install))\b|(^|\s)(>|>>)\s*\S/;

export function isMutatingToolCall(tool, args = {}) {
  const name = String(tool || "").toLowerCase();
  if (MUTATING_TOOLS.has(name)) return true;
  if (name === "bash" || name === "sh") {
    const command = String(args?.command ?? args?.cmd ?? "");
    return BASH_MUTATION_RE.test(command);
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
export function isExecutionGateStale(gate, currentPid = process.pid) {
  if (gate?.active !== true) return false;
  const ownerPid = gate?.ownerPid;
  if (!Number.isInteger(ownerPid)) return true;
  return ownerPid !== currentPid;
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

export function executionGateDirective(gate) {
  const reason = gate?.reason === "analysis-loop"
    ? "el pipeline de análisis read-only"
    : "el loop de agentes";
  return `[wait-a-minute] WAM: ${reason} está evaluando la tarea; las ediciones están bloqueadas hasta que termine. Usá lectura y análisis mientras tanto.`;
}
