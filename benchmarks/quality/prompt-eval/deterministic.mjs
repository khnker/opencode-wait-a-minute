/**
 * Deterministic observable-contract evaluator.
 *
 * This module performs "black-box" verification of prompt outputs against
 * a scenario's rubric. It is NOT semantic grading; it looks for explicit
 * observable evidence (keyphrases, regex, absence of forbidden patterns).
 *
 * If output is missing or empty, criteria are "not evaluable", never "passed".
 */

export function evaluateCriterion(criterion, output) {
  if (!output || typeof output !== "string" || output.trim().length === 0) {
    return {
      criterionId: criterion.id,
      passed: false,
      evidence: "Output missing or empty; not evaluable",
      evaluable: false,
    };
  }

  const { kind, check } = criterion;
  const normalizedOutput = output.toLowerCase();
  const normalizedCheck = check.toLowerCase();
  const found = normalizedOutput.includes(normalizedCheck);

  if (kind === "must") {
    return {
      criterionId: criterion.id,
      passed: found,
      evidence: found ? `Found required evidence: "${check}"` : `Missing required evidence: "${check}"`,
      evaluable: true,
    };
  }

  if (kind === "must-not") {
    return {
      criterionId: criterion.id,
      passed: !found,
      evidence: !found ? `Absence of forbidden pattern confirmed: "${check}"` : `Forbidden pattern found: "${check}"`,
      evaluable: true,
    };
  }

  return {
    criterionId: criterion.id,
    passed: false,
    evidence: `Unknown criterion kind: ${kind}`,
    evaluable: false,
  };
}

/**
 * Evaluates a scenario's output against its rubric.
 *
 * @param {object} scenario
 * @param {string} output
 * @returns {object[]} array of criterion verdicts
 */
export function evaluateScenario(scenario, output) {
  return scenario.criteria.map((criterion) => evaluateCriterion(criterion, output));
}
