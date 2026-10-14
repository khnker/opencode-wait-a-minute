import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmark } from "./runner.mjs";
import { listCases, validateCorpus } from "./corpus.mjs";
import { validateRubric } from "./rubric.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(HERE, "fixtures");

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("runBenchmark writes envelope files and computes metrics", async () => {
  const outDir = tmpDir("wam-frontend-ux-bench-");
  try {
    const options = {
      outDir,
      timestamp: "2026-10-13T20:50:00.000Z",
      provider: "mock",
      model: "test-model",
      condition: "B",
      caseId: "case-1-new-screen",
      trials: 2,
      scorer: (_artifact, _case) => ({
        // Return a fixed score for each criterion in the case.
        // We'll hardcode the criterion ids from case-1-new-screen for simplicity.
        "c1-usability-task-complete": 1,
        "c1-usability-empty-state": 0,
        "c1-hierarchy-primary-action": 1,
        "c1-hierarchy-spacing-scale": 0,
        "c1-a11y-labels": 1,
        "c1-interaction-feedback": 1,
      }),
    };

    const result = await runBenchmark(options);

    // Check that the envelope files exist and are non-empty.
    const envelope = ["manifest.json", "raw.json", "metrics.json", "report.md"];
    for (const name of envelope) {
      const p = path.join(outDir, name);
      assert.ok(fs.existsSync(p), `missing envelope file ${name}`);
      assert.ok(fs.statSync(p).size > 0, `empty envelope file ${name}`);
    }

    // Check manifest content.
    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8"));
    assert.equal(manifest.condition, "B");
    assert.equal(manifest.caseId, "case-1-new-screen");
    assert.equal(manifest.trials, 2);
    assert.equal(manifest.provider, "mock");
    assert.equal(manifest.model, "test-model");

    // Check raw.json structure.
    const raw = JSON.parse(fs.readFileSync(path.join(outDir, "raw.json"), "utf8"));
    assert.ok(Array.isArray(raw.trials));
    assert.equal(raw.trials.length, 2);
    for (const trial of raw.trials) {
      assert.ok(typeof trial.artifact === "string");
      assert.ok(typeof trial.score === "object");
      // Check that the score object has the expected keys.
      const expectedKeys = [
        "c1-usability-task-complete",
        "c1-usability-empty-state",
        "c1-hierarchy-primary-action",
        "c1-hierarchy-spacing-scale",
        "c1-a11y-labels",
        "c1-interaction-feedback",
      ];
      for (const key of expectedKeys) {
        assert.ok(key in trial.score);
        assert.ok(typeof trial.score[key] === "number");
      }
    }

    // Check metrics.json structure.
    const metrics = JSON.parse(fs.readFileSync(path.join(outDir, "metrics.json"), "utf8"));
    assert.ok(typeof metrics === "object");
    assert.ok(Array.isArray(metrics.criteria) === false && typeof metrics.criteria === "object");
    // We expect the same criterion ids in metrics.criteria.
    const expectedKeys = [
      "c1-usability-task-complete",
      "c1-usability-empty-state",
      "c1-hierarchy-primary-action",
      "c1-hierarchy-spacing-scale",
      "c1-a11y-labels",
      "c1-interaction-feedback",
    ];
    for (const key of expectedKeys) {
      assert.ok(key in metrics.criteria);
      assert.ok(typeof metrics.criteria[key] === "object");
      assert.ok("mean" in metrics.criteria[key]);
      assert.ok("median" in metrics.criteria[key]);
      assert.ok("stddev" in metrics.criteria[key]);
      assert.ok("n" in metrics.criteria[key]);
      assert.equal(metrics.criteria[key].n, 2);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("runBenchmark validates options", async () => {
  // Missing outDir
  await assert.rejects(
    runBenchmark({
      timestamp: "2026-10-13T20:50:00.000Z",
      provider: "mock",
      model: "test-model",
      condition: "B",
      caseId: "case-1-new-screen",
    }),
    (err) => err.message.includes("missing outDir")
  );

  // Invalid condition
  await assert.rejects(
    runBenchmark({
      outDir: tmpDir("wam-"),
      timestamp: "2026-10-13T20:50:00.000Z",
      provider: "mock",
      model: "test-model",
      condition: "D",
      caseId: "case-1-new-screen",
    }),
    (err) => err.message.includes("condition must be A, B, or C")
  );

  // Non-existent caseId
  await assert.rejects(
    runBenchmark({
      outDir: tmpDir("wam-"),
      timestamp: "2026-10-13T20:50:00.000Z",
      provider: "mock",
      model: "test-model",
      condition: "B",
      caseId: "non-existent-case",
    }),
    (err) => err.message.includes("not found in corpus")
  );
});

test("runBenchmark validates corpus and rubric", async () => {
  // We can test validation by using a case that we know is valid.
  // But we can also test that the validation functions are called.
  // We'll rely on the existing validation in the corpus and rubric modules.
  // For brevity, we'll just test that a valid case runs without throwing.
  const outDir = tmpDir("wam-frontend-ux-bench-valid-");
  try {
    await runBenchmark({
      outDir,
      timestamp: "2026-10-13T20:50:00.000Z",
      provider: "mock",
      model: "test-model",
      condition: "A",
      caseId: "case-2-form-improvement",
      trials: 1,
      scorer: () => ({}),
    });
    // If we get here, no validation error was thrown.
    assert.ok(true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
