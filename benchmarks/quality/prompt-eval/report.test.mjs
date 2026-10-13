import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it } from "node:test";
import { renderMarkdownReport, generateFullReport } from "./report.mjs";
import { runEvaluation } from "./run.mjs";

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

  it("PQ-CORR-04: report.json lists every scenario with per-criterion verdicts", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-eval-report-"));
    const suite = {
      id: "report.corr",
      version: "1.0.0",
      scenarios: [
        {
          id: "sc.report-1",
          suite: "report.corr",
          severity: "critical",
          context: "ctx",
          promptRef: "p1",
          expectation: "expect",
          criteria: [
            { id: "c1", required: true, description: "d", oracle: { kind: "includes-all", values: ["yes"], flags: "i" } },
          ],
        },
      ],
    };
    const result = runEvaluation({
      labels: ["baseline"],
      suites: [suite],
      promptContents: { baseline: { p1: "prompt body" } },
      outputsByLabel: { baseline: { "sc.report-1": "yes output" } },
      outDir,
    });
    const report = JSON.parse(fs.readFileSync(result.artifacts.reportPath, "utf8"));
    assert.strictEqual(report.scenarios.length, 1);
    const [scenario] = report.scenarios;
    assert.strictEqual(scenario.scenarioId, "sc.report-1");
    assert.strictEqual(scenario.severity, "critical");
    assert.strictEqual(typeof scenario.passed, "boolean");
    assert.strictEqual(typeof scenario.evaluable, "boolean");
    assert.ok(Array.isArray(scenario.criteria));
    assert.strictEqual(scenario.criteria.length, 1);
    const [criterion] = scenario.criteria;
    assert.strictEqual(criterion.criterionId, "c1");
    assert.strictEqual(criterion.kind, "includes-all");
    assert.strictEqual(criterion.required, true);
    assert.strictEqual(typeof criterion.passed, "boolean");
    assert.strictEqual(typeof criterion.evaluable, "boolean");
    assert.ok(typeof criterion.evidence === "string");
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("PQ-CORR-05: reported criterion kind equals oracle kind and reports are byte-identical across repeats", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-eval-repeat-"));
    const suite = {
      id: "report.repeat",
      version: "1.0.0",
      scenarios: [
        {
          id: "sc.repeat",
          suite: "report.repeat",
          severity: "high",
          context: "ctx",
          promptRef: "p1",
          expectation: "expect",
          criteria: [
            { id: "c1", required: true, description: "d", oracle: { kind: "excludes-any", values: ["no"], flags: "i" } },
          ],
        },
      ],
    };
    const a = runEvaluation({
      labels: ["baseline"],
      suites: [suite],
      promptContents: { baseline: { p1: "prompt body" } },
      outputsByLabel: { baseline: { "sc.repeat": "yes output" } },
      outDir,
    });
    const b = runEvaluation({
      labels: ["baseline"],
      suites: [suite],
      promptContents: { baseline: { p1: "prompt body" } },
      outputsByLabel: { baseline: { "sc.repeat": "yes output" } },
      outDir,
    });
    const reportA = JSON.parse(fs.readFileSync(a.artifacts.reportPath, "utf8"));
    const reportB = JSON.parse(fs.readFileSync(b.artifacts.reportPath, "utf8"));
    assert.strictEqual(reportA.scenarios[0].criteria[0].kind, "excludes-any");
    assert.strictEqual(fs.readFileSync(a.artifacts.reportPath, "utf8"), fs.readFileSync(b.artifacts.reportPath, "utf8"));
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});
