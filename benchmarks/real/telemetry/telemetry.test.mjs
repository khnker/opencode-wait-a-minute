import { test } from "node:test";
import assert from "node:assert/strict";
import { extractUsage, wamInputReduction } from "./token-usage.mjs";
import { latencyDelta } from "./latency.mjs";
import { outcomeMatches, classifyComparison } from "./outcome.mjs";

test("extractUsage defaults all fields to 0 when usage missing", () => {
  assert.deepEqual(extractUsage(undefined), {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0
  });
  assert.deepEqual(extractUsage({}), {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0
  });
});

test("extractUsage derives totalTokens when missing", () => {
  const out = extractUsage({ usage: { inputTokens: 10, outputTokens: 5 } });
  assert.equal(out.totalTokens, 15);
  assert.equal(out.cachedInputTokens, 0);
});

test("extractUsage preserves explicit totalTokens and cachedInputTokens", () => {
  const out = extractUsage({
    usage: { inputTokens: 42, outputTokens: 7, totalTokens: 49, cachedInputTokens: 13 }
  });
  assert.equal(out.inputTokens, 42);
  assert.equal(out.outputTokens, 7);
  assert.equal(out.totalTokens, 49);
  assert.equal(out.cachedInputTokens, 13);
});

test("wamInputReduction computes absolute + pct", () => {
  const out = wamInputReduction({ baseline: 1000, input: 600 });
  assert.equal(out.absolute, 400);
  assert.equal(out.pct, 40);
});

test("wamInputReduction guards div-by-zero", () => {
  const out = wamInputReduction({ baseline: 0, input: 50 });
  assert.equal(out.absolute, -50);
  assert.equal(out.pct, 0);
  assert.ok(Number.isFinite(out.pct));
});

test("wamInputReduction handles non-finite values without NaN", () => {
  // NaN baseline is coerced to 0, so there is no denominator and no NaN output.
  const out = wamInputReduction({ baseline: NaN, input: 10 });
  assert.equal(out.absolute, -10);
  assert.equal(out.pct, 0);
  assert.ok(Number.isFinite(out.absolute));
  assert.ok(Number.isFinite(out.pct));
});

test("latencyDelta computes absolute + pct", () => {
  // positive absolute = WAM arm was faster than baseline
  const out = latencyDelta({ baselineMs: 200, wamMs: 150 });
  assert.equal(out.absolute, 50);
  assert.equal(out.pct, 25);
});

test("latencyDelta guards div-by-zero", () => {
  const out = latencyDelta({ baselineMs: 0, wamMs: 50 });
  assert.equal(out.absolute, -50);
  assert.equal(out.pct, 0);
  assert.ok(Number.isFinite(out.pct));
});

test("outcomeMatches trims and compares", () => {
  assert.equal(outcomeMatches("ok", "ok"), true);
  assert.equal(outcomeMatches("  ok  ", "ok"), true);
  assert.equal(outcomeMatches("ok", "fail"), false);
  assert.equal(outcomeMatches(null, "ok"), false);
  assert.equal(outcomeMatches(undefined, undefined), true);
});

test("classifyComparison returns VALID or INVALID_COMPARISON", () => {
  assert.equal(classifyComparison(true), "VALID");
  assert.equal(classifyComparison(false), "INVALID_COMPARISON");
  assert.equal(classifyComparison(undefined), "INVALID_COMPARISON");
});
