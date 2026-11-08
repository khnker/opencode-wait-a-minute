/**
 * Requirement visibility — shared cap for listing requirement titles/IDs.
 *
 * Three renderers used to truncate requirement lists with independent hard
 * caps (5, 5 and 8). The symptom: as the number of indications grew, each
 * renderer silently dropped the tail, so many indications disappeared.
 *
 * This module centralizes the policy:
 *  - the cap is configurable via WAM_MAX_VISIBLE_REQS (bounded, positive);
 *  - the default is generous enough for realistic contracts;
 *  - pending/unfinished requirements are listed before completed ones so a
 *    cap, when it does apply, never hides work that still needs attention.
 */

export const DEFAULT_MAX_VISIBLE_REQS = 50;

export function isRequirementDone(req) {
  return req?.status === "done" || req?.status === "verified";
}

export function maxVisibleReqs() {
  const raw = Number.parseInt(process.env.WAM_MAX_VISIBLE_REQS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_VISIBLE_REQS;
}

/**
 * Order requirements pending-first (stable) and split them at the cap.
 *
 * @param {Array} reqs
 * @param {{ limit?: number, pendingFirst?: boolean }} [opts]
 * @returns {{ visible: Array, overflow: number, total: number, limit: number }}
 */
export function splitVisibleRequirements(reqs, { limit = maxVisibleReqs(), pendingFirst = true } = {}) {
  const list = Array.isArray(reqs) ? reqs : [];
  const ordered = pendingFirst
    ? [...list].sort((a, b) => Number(isRequirementDone(a)) - Number(isRequirementDone(b)))
    : list;
  const cap = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MAX_VISIBLE_REQS;
  return {
    visible: ordered.slice(0, cap),
    overflow: Math.max(0, ordered.length - cap),
    total: ordered.length,
    limit: cap,
  };
}
