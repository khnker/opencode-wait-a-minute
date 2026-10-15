export const AUTONOMOUS_RESOLUTION_MODES = Object.freeze({
  RESOLVE: "resolve",
  ESCALATE: "escalate",
  NOOP: "noop"
});

export function mustResolveAutonomously(status, problemDetected) {
  if (status === "passed" && !problemDetected) return false;
  return true;
}

export function evaluateAutonomousResolution({ status, checkId, reason } = {}, { explicitOptOut = false, optOutReason = null } = {}) {
  if (!status) return { mode: AUTONOMOUS_RESOLUTION_MODES.ESCALATE, required: true, reason: "missing verification status" };

  if (status === "passed") {
    return { mode: AUTONOMOUS_RESOLUTION_MODES.NOOP, required: false, reason: "verification passed" };
  }

  if (explicitOptOut) {
    return {
      mode: AUTONOMOUS_RESOLUTION_MODES.ESCALATE,
      required: true,
      reason: optOutReason || "explicit opt-out from autonomous resolution"
    };
  }

  return {
    mode: AUTONOMOUS_RESOLUTION_MODES.RESOLVE,
    required: true,
    reason: `problem detected in ${checkId || "unknown"}: ${reason || "unknown"}`,
    directive: "analyze root cause, implement fix, verify resolution"
  };
}
