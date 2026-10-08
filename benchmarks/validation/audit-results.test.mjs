// Test file for audit-results.mjs
import { strict as assert } from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import * as mod from "./audit-results.mjs";

describe("audit-results", () => {
  it("loads valid results and returns ok with correct count", async () => {
    const commit = "abc123";
    const results = [
      mod.buildResult(commit, "local-1", 378, 407, true, {}, ""),
      mod.buildResult(commit, "contextual-1", 1493, 703, true, {}, ""),
    ];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, true);
    assert.strictEqual(validation.resultsChecked, 2);
    assert.deepStrictEqual(validation.errors, []);
  });

  it("rejects missing commit", async () => {
    const results = [mod.buildResult("", "local-1", 378, 407, true, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.commit must be a non-empty string/);
  });

  it("rejects missing scenario", async () => {
    const results = [mod.buildResult("abc123", "", 378, 407, true, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.scenario must be a non-empty string/);
  });

  it("rejects missing baseline", async () => {
    const results = [mod.buildResult("abc123", "local-1", undefined, 407, true, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.baseline must be a finite number/);
  });

  it("rejects missing WAM", async () => {
    const results = [mod.buildResult("abc123", "local-1", 378, undefined, true, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.WAM must be a finite number/);
  });

  it("rejects stateEquivalent false", async () => {
    const results = [mod.buildResult("abc123", "local-1", 378, 407, false, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.stateEquivalent must be true/);
  });

  it("rejects missing stateEquivalent", async () => {
    const results = [mod.buildResult("abc123", "local-1", 378, 407, undefined, {}, "")];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(validation.errors[0], /result\[0\]: result.stateEquivalent must be true/);
  });

  it("rejects empty results array", async () => {
    const validation = mod.validateResults([]);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 0);
    assert.match(validation.errors[0], /empty results array/);
  });

  it("rejects incompatible metrics", async () => {
    const results = [
      mod.buildResult(
        "abc123",
        "local-1",
        378,
        407,
        true,
        { baselineTotalTokens: 999, totalTokens: 888 },
        ""
      )
    ];
    const validation = mod.validateResults(results);
    assert.strictEqual(validation.ok, false);
    assert.strictEqual(validation.resultsChecked, 1);
    assert.match(
      validation.errors[0],
      /result\[0\]: metrics.baselineTotalTokens present and !== baseline|result\[0\]: metrics.totalTokens present and !== WAM/
    );
  });
});

describe("audit-results latestResultsDir", () => {
  it("skips newer trace-replay dirs and returns the newest validation dir", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-audit-"));
    try {
      const older = path.join(root, "2026-01-01T00-00-00.000Z");
      fs.mkdirSync(older);
      fs.writeFileSync(path.join(older, "raw.json"), JSON.stringify({
        validationVersion: "1.0.0",
        composition: { scenarioIds: ["local-1"] },
        causal: { scenarios: { "local-1": { baselineTotalTokens: 1, totalTokens: 2, verification: "success" } } }
      }));
      const newer = path.join(root, "2026-01-02T00-00-00.000Z");
      fs.mkdirSync(newer);
      fs.writeFileSync(path.join(newer, "raw.json"), JSON.stringify({
        benchmark: "token-savings-evidence",
        mode: "trace-replay",
        results: [{ scenarioId: "S1" }]
      }));
      assert.equal(mod.latestResultsDir(root), older);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns null when no validation-format dir exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-audit-"));
    try {
      const d = path.join(root, "x");
      fs.mkdirSync(d);
      fs.writeFileSync(path.join(d, "raw.json"), JSON.stringify({ results: [] }));
      assert.equal(mod.latestResultsDir(root), null);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns null for a missing root", () => {
    assert.equal(mod.latestResultsDir(path.join(os.tmpdir(), "does-not-exist-wam-audit")), null);
  });
});

describe("audit-results resolveCommit", () => {
  it("falls back to 'unknown' when git provenance is unavailable", () => {
    assert.equal(mod.resolveCommit({ gitSha: null }), "unknown");
    assert.equal(mod.resolveCommit({}), "unknown");
    assert.equal(mod.resolveCommit(null), "unknown");
  });

  it("uses gitSha when present", () => {
    assert.equal(mod.resolveCommit({ gitSha: "abc123" }), "abc123");
  });
});
