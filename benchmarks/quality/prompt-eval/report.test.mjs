import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMarkdownReport, generateFullReport } from "./report.mjs";

const run = {
  schema: "prompt-eval/run@1",
  runId: "run-1",
  labels: [
    {
      label: "baseline",
      suite: { id: "verify", version: "1.0.0", hash: "abc" },
      configHash: "cfg",
      prompts: [],
      metrics: {
        evaluableCount: 1,
        totalScenarios: 1,
        mandatoryCompliance: 0,
        targetChecksPassed: 0,
        criticalRegressions: 1,
      },
      details: [
        {
          scenarioId: "verify.false-done",
          severity: "critical",
          passed: false,
          evaluable: true,
          criteria: [
            {
              criterionId: "verify.false-done.must-hold",
              kind: "must",
              passed: false,
              evaluable: true,
              evidence: "Missing required evidence: \"hold\"",
            },
          ],
        },
      ],
    },
  ],
};

describe("prompt-eval report", () => {
  it("PQ-INT-003: markdown report is deterministic and names scenario/severity", async () => {
    const md = renderMarkdownReport(run);
    assert.ok(md.includes("# Prompt Quality Report: run-1"));
    assert.ok(md.includes("verify.false-done"));
    assert.ok(md.includes("critical"));
    assert.ok(md.includes("FAIL"));
    assert.strictEqual(md, renderMarkdownReport(run));
  });

  it("generateFullReport returns JSON and markdown without nondeterministic core fields", async () => {
    const report = generateFullReport(run);
    assert.ok(report.json.includes('"runId": "run-1"'));
    assert.ok(!report.json.includes('"timestamp"'));
    assert.ok(report.markdown.includes("verify.false-done"));
  });

  it("includes the comparison decision when provided", async () => {
    const comparison = {
      decision: {
        decision: "REGRESSION",
        evidence: "critical regressions detected in: verify.false-done",
      },
    };
    const md = renderMarkdownReport(run, comparison);
    assert.ok(md.includes("Decision: REGRESSION"));
    assert.ok(md.includes("critical regressions"));
  });
});
