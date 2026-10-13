/**
 * Deterministic observable-contract evaluator.
 *
 * This module performs "black-box" verification of prompt outputs against
 * a scenario's rubric. It is NOT semantic grading; it looks for explicit
 * observable evidence (keyphrases, regex, absence of forbidden patterns).
 *
 * If output is missing or empty, criteria are "not evaluable", never "passed".
 */

const ORACLE_KINDS = new Set([
  "includes-all",
  "includes-any",
  "excludes-any",
  "matches",
  "not-matches",
]);

/**
 * Evaluate a single criterion against a prompt output using a structured oracle.
 *
 * @param {object} criterion
 * @param {string} output
 * @returns {{ criterionId: string, passed: boolean, evaluable: boolean, evidence: string }}
 */
export function evaluateCriterion(criterion, output) {
  if (!output || typeof output !== "string" || output.trim().length === 0) {
    return {
      criterionId: criterion?.id,
      passed: false,
      evidence: "Output missing or empty; not evaluable",
      evaluable: false,
    };
  }

  const { id, oracle } = criterion;

  if (!oracle || typeof oracle !== "object" || Array.isArray(oracle)) {
    return {
      criterionId: id,
      passed: false,
      evidence: "Criterion oracle is missing or malformed",
      evaluable: false,
    };
  }

  const { kind, values, flags = "i" } = oracle;

  if (!ORACLE_KINDS.has(kind)) {
    return {
      criterionId: id,
      passed: false,
      evidence: `Unknown oracle kind: ${kind}`,
      evaluable: false,
    };
  }

  if (!Array.isArray(values) || values.length === 0 || values.some((v) => typeof v !== "string" || v.length === 0)) {
    return {
      criterionId: id,
      passed: false,
      evidence: `Oracle ${kind} requires a non-empty values array of strings`,
      evaluable: false,
    };
  }

  switch (kind) {
    case "includes-all": {
      const missing = values.filter((v) => !output.toLowerCase().includes(v.toLowerCase()));
      const passed = missing.length === 0;
      return {
        criterionId: id,
        passed,
        evaluable: true,
        evidence: passed
          ? `Includes all required values: ${JSON.stringify(values)}`
          : `Missing required values: ${JSON.stringify(missing)}`,
      };
    }
    case "includes-any": {
      const found = values.find((v) => output.toLowerCase().includes(v.toLowerCase()));
      const passed = found !== undefined;
      return {
        criterionId: id,
        passed,
        evaluable: true,
        evidence: passed
          ? `Includes at least one required value: ${JSON.stringify(found)}`
          : `None of the required values present: ${JSON.stringify(values)}`,
      };
    }
    case "excludes-any": {
      const found = values.find((v) => output.toLowerCase().includes(v.toLowerCase()));
      const passed = found === undefined;
      return {
        criterionId: id,
        passed,
        evaluable: true,
        evidence: passed
          ? `None of the forbidden values present: ${JSON.stringify(values)}`
          : `Forbidden value found: ${JSON.stringify(found)}`,
      };
    }
    case "matches":
    case "not-matches": {
      const pattern = values[0];
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        return {
          criterionId: id,
          passed: false,
          evaluable: false,
          evidence: `Invalid regex pattern: ${pattern} (${e.message})`,
        };
      }
      const matched = regex.test(output);
      const passed = kind === "matches" ? matched : !matched;
      return {
        criterionId: id,
        passed,
        evaluable: true,
        evidence: passed
          ? `Regex ${kind} satisfied: /${pattern}/${flags}`
          : `Regex ${kind} not satisfied: /${pattern}/${flags}`,
      };
    }
    default:
      return {
        criterionId: id,
        passed: false,
        evidence: `Unknown oracle kind: ${kind}`,
        evaluable: false,
      };
  }
}

/**
 * Evaluates a scenario's output against its rubric.
 *
 * @param {object} scenario
 * @param {string} output
 * @returns {object} { scenarioId, severity, passed, evaluable, criteria[], mandatoryPassed }
 */
export function evaluateScenario(scenario, output) {
  const criteria = scenario?.criteria || [];
  const verdicts = criteria.map((criterion) => evaluateCriterion(criterion, output));

  const evaluableVerdicts = verdicts.filter((v) => v.evaluable);
  const mandatoryVerdicts = verdicts.filter(
    (v, idx) => criteria[idx]?.required && v.evaluable
  );

  const mandatoryPassed = mandatoryVerdicts.length > 0 && mandatoryVerdicts.every((v) => v.passed);
  const passed = evaluableVerdicts.length > 0 && evaluableVerdicts.every((v) => v.passed);
  const evaluable = evaluableVerdicts.length > 0;

  return {
    scenarioId: scenario?.id,
    severity: scenario?.severity,
    passed,
    evaluable,
    mandatoryPassed,
    criteria: verdicts,
  };
}
