/**
 * Decision engine for prompt-quality classification.
 *
 * Rules:
 * 1. Any critical-scenario regression -> REGRESSION (blocks IMPROVED).
 * 2. Mandatory compliance reduction cannot be offset by other gains.
 * 3. IMPROVED: improvement in >=1 target metric AND no critical regressions.
 * 4. Equivalent behavior -> NO_CHANGE.
 * 5. Insufficient evidence/missing results -> INCONCLUSIVE.
 * 6. Every decision must carry evidence links.
 */

export const DECISIONS = {
  IMPROVED: "IMPROVED",
  NO_CHANGE: "NO_CHANGE",
  REGRESSION: "REGRESSION",
  INCONCLUSIVE: "INCONCLUSIVE",
};

export function classify(baseline, candidate) {
  const { metrics: bMet, details: bDet } = baseline;
  const { metrics: cMet, details: cDet } = candidate;

  // 5. Insufficient evidence
  if (cMet.evaluableCount === 0 || cMet.totalScenarios === 0) {
    return {
      decision: DECISIONS.INCONCLUSIVE,
      evidence: "Insufficient evaluable results in candidate arm",
    };
  }

  // 1. Critical Regression
  if (cMet.criticalRegressions > bMet.criticalRegressions) {
    const regressed = cDet
      .filter((d, i) => d.severity === "critical" && !d.passed && bDet[i].passed)
      .map((d) => `${d.scenarioId} critical criterion`);
    return {
      decision: DECISIONS.REGRESSION,
      evidence: `critical regressions detected in: ${regressed.join(", ")}`,
    };
  }

  // 2. Mandatory Compliance Drop
  if (cMet.mandatoryCompliance < bMet.mandatoryCompliance) {
    return {
      decision: DECISIONS.REGRESSION,
      evidence: `Mandatory compliance dropped from ${bMet.mandatoryCompliance}% to ${cMet.mandatoryCompliance}%`,
    };
  }

  // 3. Improvement
  const improvedTarget = cMet.targetChecksPassed > bMet.targetChecksPassed;
  const noCriticals = cMet.criticalRegressions === 0;
  if (improvedTarget && noCriticals) {
    return {
      decision: DECISIONS.IMPROVED,
      evidence: `Target checks improved (${bMet.targetChecksPassed} -> ${cMet.targetChecksPassed}) with no critical regressions`,
    };
  }

  // 4. Equivalent
  if (cMet.mandatoryCompliance === bMet.mandatoryCompliance && 
      cMet.targetChecksPassed === bMet.targetChecksPassed) {
    return {
      decision: DECISIONS.NO_CHANGE,
      evidence: "Behaviorally equivalent in mandatory and target metrics",
    };
  }

  return {
    decision: DECISIONS.INCONCLUSIVE,
    evidence: "Metrics do not clearly map to a decision category",
  };
}
