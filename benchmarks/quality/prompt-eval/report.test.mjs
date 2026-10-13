import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMarkdownReport, generateFullReport } from "./report.mjs";

describe("prompt-eval report", () => {
  it("PQ-INT-003: markdown report is deterministic and names scenario/severity", async () => {
    const run = {
      runId: "run-1",
      labels: ["baseline"],
      scenarios: [
        { id: "verify.false-done", severity: "critical", classification: "REGRESSION", expectation: "Hold pending" },
      ],
    };
    const md = renderMarkdownReport(run);
    assert.ok(md.includes("# Prompt Quality Report: run-1"));
    assert.ok(md.includes("verify.false-done"));
    assert.ok(md.includes("critical"));
    assert.ok(md.includes("REGRESSION"));
  });

  it("generateFullReport returns JSON and markdown without nondeterministic core fields", async () => {
    const run = { runId: "run-1", labels: ["baseline"], scenarios: [] };
    const report = generateFullReport(run);
    assert.ok(report.json.includes('"runId": "run-1"'));
    assert.ok(!report.json.includes('"timestamp"'));
  });
});
