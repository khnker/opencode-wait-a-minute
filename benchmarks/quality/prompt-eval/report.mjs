/**
 * Report generator for prompt-quality runs.
 */

import { serializeReport } from "./run.mjs";

export function renderMarkdownReport(report) {
  const { runId, labels, scenarios } = report;
  let md = `# Prompt Quality Report: ${runId}\n\n`;
  md += `**Labels**: ${labels.join(", ")}\n\n`;
  md += `| Scenario | Severity | Classification | Evidence |\n`;
  md += `|---|---|---|---|\n`;

  scenarios.forEach(s => {
    md += `| ${s.id} | ${s.severity} | ${s.classification} | ${s.expectation} |\n`;
  });

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
    markdown: renderMarkdownReport(run),
  };
}
