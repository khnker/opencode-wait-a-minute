/**
 * Report generator for prompt-quality runs.
 *
 * Consumes the real run record shape:
 *   { schema, runId, labels: [{ label, suite, configHash, prompts, metrics, details }] }
 * where each `details` entry is one evaluated scenario carrying its
 * per-criterion results, and an optional comparison record
 *   { decision: { decision, evidence } }.
 */

import { serializeReport } from "./run.mjs";

function scenarioStatus(detail) {
  if (detail.evaluable === false) return "NOT-EVALUABLE";
  return detail.passed ? "PASS" : "FAIL";
}

export function renderMarkdownReport(run, comparison = null) {
  const labels = (run.labels || []).map((l) => l.label);
  let md = `# Prompt Quality Report: ${run.runId}\n\n`;
  md += `**Labels**: ${labels.join(", ")}\n\n`;

  for (const label of run.labels || []) {
    md += `## Label: ${label.label}\n\n`;
    const m = label.metrics || {};
    md += `**Metrics**: evaluable=${m.evaluableCount ?? 0}/${m.totalScenarios ?? 0}, `;
    md += `mandatoryCompliance=${m.mandatoryCompliance ?? 0}, `;
    md += `targetChecksPassed=${m.targetChecksPassed ?? 0}, `;
    md += `criticalRegressions=${m.criticalRegressions ?? 0}\n\n`;

    md += `| Scenario | Severity | Status | Criterion | Result | Evidence |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const detail of label.details || []) {
      const status = scenarioStatus(detail);
      const criteria = detail.criteria || [];
      if (criteria.length === 0) {
        md += `| ${detail.scenarioId} | ${detail.severity} | ${status} | (none) | - | - |\n`;
      }
      for (const c of criteria) {
        const result =
          c.evaluable === false ? "NOT-EVALUABLE" : c.passed ? "PASS" : "FAIL";
        md += `| ${detail.scenarioId} | ${detail.severity} | ${status} | ${c.criterionId} | ${result} | ${c.evidence} |\n`;
      }
    }
    md += `\n`;
  }

  if (comparison && comparison.decision) {
    md += `## Decision: ${comparison.decision.decision}\n\n`;
    md += `**Evidence**: ${comparison.decision.evidence}\n`;
  }

  return md;
}

export function generateFullReport(run, comparison = null) {
  const report = {
    runId: run.runId,
    run: run,
    comparison: comparison,
  };
  return {
    json: serializeReport(report),
    markdown: renderMarkdownReport(run, comparison),
  };
}
