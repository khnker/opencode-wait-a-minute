import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runEvaluation } from "./run.mjs";
import { compareRuns } from "./compare.mjs";
import { DECISIONS } from "./decision.mjs";

function tempOutDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-pe-exec-"));
}

const scenario = {
  id: "exec.hold",
  suite: "exec-suite",
  severity: "critical",
  context: "x",
  promptRef: "p1",
  criteria: [
    { id: "exec.hold.must", required: true, description: "must hold", oracle: { kind: "includes-all", values: ["hold"], flags: "i" } },
    { id: "exec.hold.forbidden", required: true, description: "must-not include DONE", oracle: { kind: "excludes-any", values: ["DONE"], flags: "i" } },
  ],
  expectation: "hold pending",
};

function runWith(baselineOutput, candidateOutput) {
  return runEvaluation({
    labels: ["baseline", "candidate"],
    suites: [{ id: "exec-suite", version: "1.0.0", scenarios: [scenario] }],
    promptContents: { baseline: { p1: "b" }, candidate: { p1: "c" } },
    outputsByLabel: {
      baseline: { "exec.hold": baselineOutput },
      candidate: { "exec.hold": candidateOutput },
    },
    outDir: tempOutDir(),
  });
}

describe("prompt-eval execution", () => {
  it("PQ-EXEC-01: runEvaluation evaluates every scenario and records per-criterion results", async () => {
    const { run } = runWith("hold pending", "hold pending");
    const label = run.labels[0];
    assert.strictEqual(label.metrics.totalScenarios, 1);
    assert.strictEqual(label.metrics.evaluableCount, 1);
    assert.strictEqual(label.details.length, 1);

    const detail = label.details[0];
    assert.strictEqual(detail.scenarioId, "exec.hold");
    assert.strictEqual(detail.severity, "critical");
    assert.strictEqual(detail.passed, true);
    assert.strictEqual(detail.criteria.length, 2);
    for (const c of detail.criteria) {
      assert.ok(Object.prototype.hasOwnProperty.call(c, "passed"));
      assert.ok(Object.prototype.hasOwnProperty.call(c, "evidence"));
      assert.ok(Object.prototype.hasOwnProperty.call(c, "evaluable"));
    }
  });

  it("PQ-EXEC-INT-01: recorded baseline vs deliberately regressed candidate => REGRESSION", async () => {
    const { run } = runWith("hold pending", "DONE, aborted");
    const comparison = compareRuns(
      { labels: [run.labels[0]] },
      { labels: [run.labels[1]] },
    );
    assert.strictEqual(comparison.decision.decision, DECISIONS.REGRESSION);
    assert.ok(comparison.decision.evidence.includes("critical"));
  });
});
