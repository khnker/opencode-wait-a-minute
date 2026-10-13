/**
 * Aggregates prompt-eval verdicts into deterministic metrics.
 */

import { SEVERITIES } from "./schema.mjs";

export function aggregateMetrics(scenariosResults) {
  const metrics = {
    totalScenarios: scenariosResults.length,
    mandatoryCompliance: 0, // % of 'required: true' criteria passed
    targetChecksPassed: 0,   // count of all passed criteria
    criticalRegressions: 0,   // count of failed 'critical' scenarios
    evaluableCount: 0,
    details: [],
  };

  let totalMandatory = 0;
  let passedMandatory = 0;

  scenariosResults.forEach(({ scenario, verdicts }) => {
    const scenarioId = scenario.id;
    const severity = scenario.severity;
    let scenarioPassed = true;
    let scenarioEvaluable = false;

    const scenarioVerdicts = verdicts.map((v) => {
      if (v.evaluable) scenarioEvaluable = true;
      if (v.passed) metrics.targetChecksPassed++;
      return v;
    });

    // We need a way to know if the criterion was 'required' for mandatory compliance
    // The verdicts from deterministic.mjs don't carry 'required' flag, so we correlate
    scenario.criteria.forEach((crit, i) => {
      const verdict = scenarioVerdicts[i];
      if (crit.required) {
        totalMandatory++;
        if (verdict.passed) passedMandatory++;
        if (!verdict.passed) scenarioPassed = false;
      }
    });

    if (!scenarioPassed && SEVERITIES.indexOf(severity) === 0) {
      metrics.criticalRegressions++;
    }

    if (scenarioEvaluable) metrics.evaluableCount++;

    metrics.details.push({
      scenarioId,
      severity,
      passed: scenarioPassed,
      evaluable: scenarioEvaluable,
      verdicts: scenarioVerdicts,
    });
  });

  metrics.mandatoryCompliance = totalMandatory > 0 
    ? (passedMandatory / totalMandatory) * 100 
    : 100;

  return metrics;
}
