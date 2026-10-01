import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDryRun } from "../run-real.mjs";
import { buildEvidenceManifest, sha256File } from "./manifest.mjs";

test("runDryRun writes manifest.json with schema and artifact hash", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-rc1-manifest-"));
  try {
    const result = await runDryRun({ outDir });
    assert.ok(result.manifest, "manifest returned in result");
    const manifestPath = path.join(outDir, "manifest.json");
    assert.ok(fs.existsSync(manifestPath), "manifest.json written to disk");
    const onDisk = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.equal(onDisk.schema, "rc1-evidence-manifest@1");
    assert.equal(result.manifest.schema, "rc1-evidence-manifest@1");
    const reportPath = path.join(outDir, "real-report.json");
    const expectedSha = sha256File(reportPath);
    assert.equal(onDisk.artifacts[0].sha256, expectedSha);
    assert.equal(onDisk.artifacts[0].bytes, fs.statSync(reportPath).size);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("default dry-run counts match expected (30 runs / 5 trials / 5 pairs)", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-rc1-counts-"));
  try {
    const { manifest } = await runDryRun({ outDir });
    assert.equal(manifest.counts.runs, 30);
    assert.equal(manifest.counts.trials, 5);
    assert.equal(manifest.counts.pairs, 5);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("manifest carries a non-empty evidence category and at least one limitation", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-rc1-evidence-"));
  try {
    const { manifest } = await runDryRun({ outDir });
    assert.equal(typeof manifest.evidenceCategory, "string");
    assert.ok(manifest.evidenceCategory.length > 0);
    assert.ok(Array.isArray(manifest.limitations));
    assert.ok(manifest.limitations.length >= 1);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("buildEvidenceManifest works standalone and yields empty artifacts without reportPath", () => {
  const fakeReport = {
    mode: "dry-run",
    provider: "mock",
    model: "mock-1",
    evidence: { execution: "deterministic_simulation", tokens: "simulated", correctness: "fixture_defined", mechanism: "measured" },
    runs: [{}, {}],
    totals: { trials: 1 },
    pairs: { a: 1 },
    statistics: { mean: 1 },
    claims: { foo: "bar" }
  };
  const manifest = buildEvidenceManifest({ report: fakeReport, repoCommit: "abc123" });
  assert.equal(manifest.schema, "rc1-evidence-manifest@1");
  assert.equal(manifest.repoCommit, "abc123");
  assert.equal(manifest.evidenceCategory, "unknown");
  assert.deepEqual(manifest.artifacts, []);
  assert.equal(manifest.counts.runs, 2);
  assert.equal(manifest.counts.trials, 1);
  assert.equal(manifest.counts.pairs, 1);
});

test("buildEvidenceManifest tolerates string-form evidence category", () => {
  const fakeReport = {
    mode: "real-llm",
    runs: [],
    totals: { trials: 0 },
    pairs: {},
    evidence: "deterministic_simulation"
  };
  const manifest = buildEvidenceManifest({ report: fakeReport });
  assert.equal(manifest.evidenceCategory, "deterministic_simulation");
  assert.equal(manifest.repoCommit, "unknown");
});