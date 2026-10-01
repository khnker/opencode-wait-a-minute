/**
 * Outcome-parity guardrail for the RC1 paired-LLM experiment.
 *
 * Protocol rule 3 (Outcome Parity): if the baseline and WAM arms do not reach
 * the same task outcome, the comparison is INVALID and no token savings may be
 * aggregated from it.
 */

export const VALID = "VALID";
export const INVALID_COMPARISON = "INVALID_COMPARISON";

/**
 * Compare two turn outcomes, ignoring leading/trailing whitespace.
 * Missing outcomes are treated as the empty string so a turn that produced no
 * output on one arm never silently matches a populated one.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function outcomeMatches(a, b) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  return left === right;
}

/**
 * Turn a boolean parity result into the protocol comparison verdict.
 *
 * @param {boolean} outcomeMatch
 * @returns {"VALID"|"INVALID_COMPARISON"}
 */
export function classifyComparison(outcomeMatch) {
  return outcomeMatch === true ? VALID : INVALID_COMPARISON;
}
