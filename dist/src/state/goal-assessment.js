/**
 * Goal Assessment — records the agent's self-assessment of whether the
 * implemented change satisfies the user's goal before the task can be
 * marked as DONE.
 *
 * This is the "Verify" policy made explicit: the agent must not confuse
 * an action performed with a result demonstrated. Before DONE, the agent
 * must record a self-assessment with rationale and status.
 */

export const GOAL_ASSESSMENT_STATUS = Object.freeze({
  SATISFIED: "SATISFIED",
  NOT_SATISFIED: "NOT_SATISFIED",
});

export const GOAL_ASSESSMENT_STATUS_VALUES = Object.values(GOAL_ASSESSMENT_STATUS);

/**
 * Normalize a goal assessment status string.
 * @param {string} value
 * @returns {string|null}
 */
export function normalizeGoalAssessmentStatus(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return GOAL_ASSESSMENT_STATUS_VALUES.includes(v) ? v : null;
}

/**
 * Validate that a goal assessment status is one of the allowed values.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidGoalAssessmentStatus(value) {
  return normalizeGoalAssessmentStatus(value) !== null;
}

/**
 * Create a new goal assessment record.
 * @param {string} status - SATISFIED or NOT_SATISFIED
 * @param {string} rationale
 * @returns {Object}
 */
export function createGoalAssessment(status, rationale) {
  const normalized = normalizeGoalAssessmentStatus(status);
  if (!normalized) {
    throw new Error(`Invalid goal assessment status: ${status}`);
  }
  return {
    status: normalized,
    rationale: String(rationale || "").trim(),
    assessedAt: Date.now(),
  };
}

/**
 * Normalize a goal assessment from a persisted state object.
 * @param {Object|null|undefined} assessment
 * @returns {Object|null}
 */
export function normalizeGoalAssessment(assessment) {
  if (!assessment || typeof assessment !== "object") return null;
  const status = normalizeGoalAssessmentStatus(assessment.status);
  if (!status) return null;
  return {
    status,
    rationale: String(assessment.rationale || "").trim(),
    assessedAt: typeof assessment.assessedAt === "number" ? assessment.assessedAt : Date.now(),
  };
}

/**
 * Check whether a goal assessment is present and SATISFIED.
 * @param {Object|null|undefined} assessment
 * @returns {boolean}
 */
export function isGoalSatisfied(assessment) {
  const normalized = normalizeGoalAssessment(assessment);
  return normalized !== null && normalized.status === GOAL_ASSESSMENT_STATUS.SATISFIED;
}
