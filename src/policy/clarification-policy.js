/**
 * Ask-vs-assume clarification policy.
 *
 * Block only when the decision is critical, unresolved by context/history and
 * expensive to get wrong. Otherwise record an assumption and continue.
 */

export const CLARIFICATION = Object.freeze({
  ASK: "ask",
  ASSUME: "assume",
});

const HIGH_RISK = new Set(["destructive", "security", "migration", "external"]);

/**
 * @param {{
 *   classification?: string,
 *   resolved?: boolean,
 *   historyAnswer?: any,
 *   contextAnswer?: any,
 *   risk?: string
 * }} input
 * @returns {{ decision: "ask"|"assume", reason: string, answer?: any }}
 */
export function decideClarification(input = {}) {
  const {
    classification,
    resolved = false,
    historyAnswer = null,
    contextAnswer = null,
    risk = "low",
  } = input;

  if (classification !== "DECISION_CRITICAL") {
    return { decision: CLARIFICATION.ASSUME, reason: "non-critical" };
  }
  if (resolved || historyAnswer != null || contextAnswer != null) {
    return {
      decision: CLARIFICATION.ASSUME,
      reason: "resolved-by-context",
      answer: historyAnswer ?? contextAnswer,
    };
  }
  if (HIGH_RISK.has(risk)) {
    return { decision: CLARIFICATION.ASK, reason: `high-risk:${risk}` };
  }
  return { decision: CLARIFICATION.ASSUME, reason: "low-risk-unresolved" };
}
