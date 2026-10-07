// Test file for audit-results.mjs
import { strict as assert } from "node:assert";
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