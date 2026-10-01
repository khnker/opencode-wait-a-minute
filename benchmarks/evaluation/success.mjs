import { isEquivalent } from "./equivalence.mjs";

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Map a `canComplete(taskRoot, taskId)` result to the verification shape used by
 * `evaluateTask`. Defensive against malformed/null gates: returns a verification
 * object with `completionAllowed=false` and zeroed counters.
 */
export function buildVerificationFromGate(gate) {
  if (!gate || typeof gate !== "object" || !gate.summary || typeof gate.summary !== "object") {
    return {
      requirementsTotal: 0,
      requirementsVerified: 0,
      evidenceValid: false,
      blockingAssumptions: 0,
      completionAllowed: false
    };
  }

  const summary = gate.summary;
  const blockers = safeArray(gate.blockers);

  const allowed = gate.allowed === true;
  const evidenceBlocked = blockers.some(b =>
    String(b && b.reason ? b.reason : "").toLowerCase().includes("evidence")
  );

  return {
    requirementsTotal: safeNumber(summary.total),
    requirementsVerified: safeNumber(summary.complete),
    evidenceValid: allowed === true || !evidenceBlocked,
    blockingAssumptions: safeNumber(summary.blocked),
    completionAllowed: allowed
  };
}

/**
 * Evaluate a single task turn.
 *
 * PRIMARY RULE: when `expected.verification` is provided, success is driven by
 * `completionAllowed` from verification (textual equivalence is demoted to a
 * secondary metric and CANNOT change success). When verification is absent,
 * the legacy behavior is preserved exactly: success = testsPassed && filesExpected && equivalent.
 */
export function evaluateTask({ baseline, wam, expected = {} } = {}) {
  const testsPassed = expected.testsPassed ?? Boolean(wam && wam.response && String(wam.response).length > 0);
  const filesExpected = expected.filesExpected ?? true;
  const equivalent = expected.expectedResponse != null
    ? isEquivalent(wam && wam.response, expected.expectedResponse)
    : isEquivalent(baseline && baseline.response, wam && wam.response);

  const verification = expected.verification && typeof expected.verification === "object"
    ? {
        requirementsTotal: safeNumber(expected.verification.requirementsTotal),
        requirementsVerified: safeNumber(expected.verification.requirementsVerified),
        evidenceValid: expected.verification.evidenceValid === true,
        blockingAssumptions: safeNumber(expected.verification.blockingAssumptions),
        completionAllowed: expected.verification.completionAllowed === true
      }
    : null;

  let success;
  let completionAllowed;
  let correctnessSource;

  if (verification) {
    correctnessSource = "verification";
    completionAllowed = verification.completionAllowed === true;
    success = completionAllowed;
  } else {
    correctnessSource = "fallback";
    completionAllowed = Boolean(testsPassed && filesExpected);
    success = Boolean(testsPassed && filesExpected && equivalent);
  }

  return {
    success,
    equivalent,
    testsPassed,
    filesExpected,
    correctnessSource,
    completionAllowed,
    verification
  };
}