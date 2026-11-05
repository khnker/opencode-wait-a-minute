const NEEDS_USER_STATUSES = new Set(["BLOCKED", "NEEDS_INPUT", "FAILED"]);

export function isTerminalAgentSignal(agent) {
  return (
    Boolean(agent) && (agent.exhausted === true || NEEDS_USER_STATUSES.has(agent.status))
  );
}

export function agentSignalForLoop(outcome, task) {
  if (outcome) return outcome;
  const run = task?.agentRun;
  if (!run || typeof run !== "object") return null;
  if (run.exhausted !== true && !NEEDS_USER_STATUSES.has(run.status)) return null;
  return {
    status: run.status ?? null,
    verdict: run.verdict ?? null,
    exhausted: run.exhausted === true,
    stale: true,
    surfaced: run.surfaced === true,
    ...(typeof run.failureReason === "string" && run.failureReason
      ? { failureReason: run.failureReason }
      : {}),
    ...(typeof run.failureCode === "string" && run.failureCode
      ? { failureCode: run.failureCode }
      : {}),
    ...(Number.isInteger(run.attempts) ? { attempts: run.attempts } : {}),
    results: Array.isArray(run.results) ? run.results : [],
  };
}

export function reopenTerminalAgentRun(state) {
  if (!state || typeof state !== "object") return false;
  const run = state.agentRun;
  if (!run || typeof run !== "object") return false;
  const terminal = run.exhausted === true || NEEDS_USER_STATUSES.has(run.status);
  if (!terminal) return false;
  state.agentRun = {
    ...run,
    status: null,
    verdict: null,
    stoppedAt: null,
    exhausted: false,
    surfaced: false,
    cycles: { revisions: 0, replans: 0 },
  };
  delete state.agentRun.failureReason;
  return true;
}

export function resetAuthorizationSurface(state) {
  if (!state || typeof state !== "object" || state.authorizationSurfacedId == null) {
    return false;
  }
  state.authorizationSurfacedId = null;
  return true;
}
