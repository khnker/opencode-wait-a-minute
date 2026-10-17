// Claim-level completion gate for CH-05 (skill-verification-completion).
// Builds on the existing verification subsystem (verification-model.js) by adding
// the explicit verification_method enum and the claim state model that gates a
// completion token (DONE/COMPLETED/FIXED/VERIFIED) behind VERIFIED state.

export const VERIFICATION_METHODS = ["automated", "observational", "external_evidence", "human_confirmation"];

export const CLAIM_STATES = {
  CLAIMED: "CLAIMED",
  SUPPORTED: "SUPPORTED",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
};

export const COMPLETION_TOKENS = ["DONE", "COMPLETED", "FIXED", "VERIFIED", "TASK_COMPLETE"];

export function isValidMethod(method) {
  return VERIFICATION_METHODS.includes(method);
}

export function evaluateClaim(claim = {}) {
  const c = { ...claim, state: claim.state || CLAIM_STATES.CLAIMED };
  if (!isValidMethod(c.method)) {
    return { ...c, state: CLAIM_STATES.UNKNOWN, reason: "missing_or_invalid_method" };
  }
  if (c.contradicted) {
    return { ...c, state: CLAIM_STATES.FAILED, reason: "contradicted_by_verification" };
  }
  if (c.evidence) {
    return { ...c, state: CLAIM_STATES.VERIFIED, reason: "verified_with_evidence" };
  }
  if (c.method === "observational" && c.observation) {
    return { ...c, state: CLAIM_STATES.VERIFIED, reason: "observation_recorded" };
  }
  if (c.support) {
    return { ...c, state: CLAIM_STATES.SUPPORTED, reason: "supported_not_satisfying_method" };
  }
  return { ...c, state: CLAIM_STATES.UNKNOWN, reason: "no_evidence" };
}

export function createClaim(text, opts = {}) {
  return evaluateClaim({
    text,
    method: isValidMethod(opts.method) ? opts.method : null,
    evidence: opts.evidence || null,
    observation: opts.observation || null,
    support: opts.support || null,
    contradicted: Boolean(opts.contradicted),
  });
}

export function verifyWithMethod(claim, { method, evidence, contradicts = false } = {}) {
  return evaluateClaim({ ...claim, method, evidence: evidence || null, contradicted: contradicts });
}

export function isCompletionToken(text) {
  const s = String(text || "");
  return COMPLETION_TOKENS.some((t) => new RegExp("\\b" + t + "\\b", "i").test(s));
}

export function guardCompletion(text, claim) {
  const token = isCompletionToken(text);
  const state = (claim && claim.state) || CLAIM_STATES.UNKNOWN;
  const allowed = state === CLAIM_STATES.VERIFIED;
  return { token, state, allowed, blocked: token && !allowed };
}
