/**
 * Schema + hand-rolled validators for the prompt-quality benchmark.
 *
 * The package ships no schema dependency (only `context-query-core`), so the
 * contract is enforced with explicit validators. Every failure throws
 * `PromptEvalSchemaError` with an actionable message and an `errors` array: a
 * malformed suite fails loudly instead of being silently skipped.
 *
 * Pure module: no I/O, no network, no deps.
 */

export class PromptEvalSchemaError extends Error {
  /**
   * @param {string} message
   * @param {string[]} [errors]
   */
  constructor(message, errors = []) {
    super(message);
    this.name = "PromptEvalSchemaError";
    this.errors = errors;
  }
}

export const SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);
export const CRITERION_KINDS = Object.freeze(["must", "must-not"]);
export const SUITE_SCHEMA = "wam.prompt-eval.suite/1";

const SCENARIO_STRING_FIELDS = ["id", "suite", "severity", "context", "promptRef", "expectation"];
const CRITERION_STRING_FIELDS = ["id", "kind", "check"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function fail(message) {
  throw new PromptEvalSchemaError(message, [message]);
}

/**
 * @param {unknown} criterion
 * @param {string} where
 * @param {Set<string>} seenIds
 * @param {string[]} errors
 */
function validateCriterion(criterion, where, seenIds, errors) {
  if (!criterion || typeof criterion !== "object" || Array.isArray(criterion)) {
    errors.push(`${where} must be an object`);
    return;
  }
  for (const field of CRITERION_STRING_FIELDS) {
    if (!isNonEmptyString(criterion[field])) {
      errors.push(`${where}.${field} is a mandatory field and must be a non-empty string`);
    }
  }
  if (typeof criterion.required !== "boolean") {
    errors.push(`${where}.required is a mandatory field and must be a boolean`);
  }
  if (isNonEmptyString(criterion.kind) && !CRITERION_KINDS.includes(criterion.kind)) {
    errors.push(`${where}.kind "${criterion.kind}" must be one of ${CRITERION_KINDS.join(" | ")}`);
  }
  if (isNonEmptyString(criterion.id)) {
    if (seenIds.has(criterion.id)) {
      errors.push(`${where}.id "${criterion.id}" is a duplicate criterion id`);
    }
    seenIds.add(criterion.id);
  }
}

/**
 * Validate a single scenario. Throws on the first batch of accumulated errors.
 *
 * @param {unknown} scenario
 * @param {{ index?: number, suiteId?: string }} [ctx]
 * @returns {object} the scenario (unchanged)
 */
export function validateScenario(scenario, { index = 0, suiteId } = {}) {
  const where = `scenario[${index}]${suiteId ? ` in suite "${suiteId}"` : ""}`;
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    fail(`prompt-eval: ${where} must be an object`);
  }

  const errors = [];
  for (const field of SCENARIO_STRING_FIELDS) {
    if (!isNonEmptyString(scenario[field])) {
      errors.push(`${where}.${field} is required and must be a non-empty string`);
    }
  }
  if (isNonEmptyString(scenario.severity) && !SEVERITIES.includes(scenario.severity)) {
    errors.push(`${where}.severity "${scenario.severity}" must be one of ${SEVERITIES.join(" | ")}`);
  }
  if (suiteId && isNonEmptyString(scenario.suite) && scenario.suite !== suiteId) {
    errors.push(`${where}.suite "${scenario.suite}" must match containing suite id "${suiteId}"`);
  }

  if (!Array.isArray(scenario.criteria) || scenario.criteria.length === 0) {
    errors.push(`${where}.criteria must be a non-empty array`);
  } else {
    const seenIds = new Set();
    scenario.criteria.forEach((criterion, i) =>
      validateCriterion(criterion, `${where}.criteria[${i}]`, seenIds, errors),
    );
  }

  if (errors.length) {
    throw new PromptEvalSchemaError(
      `prompt-eval: invalid scenario:\n- ${errors.join("\n- ")}`,
      errors,
    );
  }
  return scenario;
}

/**
 * Validate a suite: shape, per-scenario contract and intra-suite uniqueness.
 *
 * @param {unknown} suite
 * @returns {object} the suite (unchanged)
 */
export function validateSuite(suite) {
  if (!suite || typeof suite !== "object" || Array.isArray(suite)) {
    fail("prompt-eval: suite must be an object");
  }

  const errors = [];
  for (const field of ["id", "version"]) {
    if (!isNonEmptyString(suite[field])) {
      errors.push(`suite.${field} is required and must be a non-empty string`);
    }
  }
  if (!Array.isArray(suite.scenarios) || suite.scenarios.length === 0) {
    errors.push("suite.scenarios must be a non-empty array");
  }
  if (errors.length) {
    throw new PromptEvalSchemaError(`prompt-eval: invalid suite:\n- ${errors.join("\n- ")}`, errors);
  }

  const seen = new Set();
  suite.scenarios.forEach((scenario, i) => {
    validateScenario(scenario, { index: i, suiteId: suite.id });
    if (seen.has(scenario.id)) {
      fail(`prompt-eval: duplicate scenario id "${scenario.id}" in suite "${suite.id}"`);
    }
    seen.add(scenario.id);
  });
  return suite;
}

/**
 * Validate a dataset: every suite plus cross-suite scenario-id uniqueness.
 *
 * @param {unknown} suites
 * @returns {object[]} the suites (unchanged)
 */
export function validateDataset(suites) {
  if (!Array.isArray(suites) || suites.length === 0) {
    fail("prompt-eval: dataset must be a non-empty array of suites");
  }
  const seen = new Map();
  for (const suite of suites) {
    validateSuite(suite);
    for (const scenario of suite.scenarios) {
      const owner = seen.get(scenario.id);
      if (owner !== undefined) {
        fail(
          `prompt-eval: duplicate scenario id "${scenario.id}" across dataset ` +
            `(suites "${owner}" and "${suite.id}")`,
        );
      }
      seen.set(scenario.id, suite.id);
    }
  }
  return suites;
}
