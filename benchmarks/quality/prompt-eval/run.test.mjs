import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runEvaluation, serializeReport } from "./run.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function createTempOutDir() {
  const tmpDir = path.join(os.tmpdir(), "wam-prompt-eval-");
  fs.mkdirSync(tmpDir, { recursive: true });
  const outDir = fs.mkdtempSync(path.join(tmpDir, "run-"));
  return outDir;
}

describe("prompt-eval run", () => {
  it("PQ-INT-005: deterministic eval completes with no API keys", async () => {
    const suites = [{
      id: "test-suite",
      version: "1.0",
      scenarios: [{
        id: "s1",
        suite: "test-suite",
        severity: "low",
        context: "x",
        promptRef: "p1",
        criteria: [{ id: "c1", required: true, description: "must contain x", oracle: { kind: "includes-all", values: ["x"], flags: "i" } }],
        expectation: "x"
      }]
    }];
    const promptContents = {
      baseline: { "p1": "content 1" },
      candidate: { "p1": "content 2" }
    };

    const outDir = createTempOutDir();
    const { runId, run, artifacts } = runEvaluation({
      labels: ["baseline", "candidate"],
      suites,
      promptContents,
      outDir,
    });

    assert.ok(runId);
    assert.ok(run.labels.length === 2);
    assert.ok(artifacts.runPath && artifacts.reportPath);

    assert.ok(fs.existsSync(artifacts.runPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
  });

  it("serialized cores are stable across repeats", async () => {
    const promptContents = { baseline: { "p1": "c" } };
    const outDir1 = createTempOutDir();
    const outDir2 = createTempOutDir();

    const suitesFull = [{
      id: "s", version: "1",
      scenarios: [{ id: "sc1", suite: "s", severity: "low", context: "x", promptRef: "p1",         criteria: [{id:"c", required:true, description:"must contain x", oracle:{kind:"includes-all", values:["x"], flags:"i"}}], expectation: "x" }]
    }];

    const res1 = runEvaluation({ labels: ["baseline"], suites: suitesFull, promptContents, outDir: outDir1 });
    const res2 = runEvaluation({ labels: ["baseline"], suites: suitesFull, promptContents, outDir: outDir2 });

    assert.strictEqual(serializeReport(res1.run), serializeReport(res2.run), "Byte-identical serialization");
  });
});
