import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  median,
  stddev,
  quantile,
  ci95,
  welchTTest,
  cohensD,
  pairedDelta,
  summarize
} from "./statistics.mjs";

test("mean of [1,2,3] === 2", () => {
  assert.equal(mean([1, 2, 3]), 2);
});

test("mean of empty array === 0", () => {
  assert.equal(mean([]), 0);
});

test("mean ignores non-finite values", () => {
  // (1 + 3 + 5) / 3 = 3 (NaN and Infinity are filtered out)
  assert.equal(mean([1, NaN, 3, Infinity, 5]), 3);
});

test("median of odd-length array picks middle", () => {
  assert.equal(median([3, 1, 2]), 2);
});

test("median of even-length array averages middle two", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("stddev sample (n-1) for [2,4,4,4,5,5,7,9] ≈ 2.138", () => {
  const s = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.ok(Math.abs(s - 2.138089935299395) < 1e-6, `stddev was ${s}`);
});

test("stddev of single value === 0", () => {
  assert.equal(stddev([5]), 0);
});

test("stddev of empty array === 0", () => {
  assert.equal(stddev([]), 0);
});

test("quantile uses linear interpolation (type-7)", () => {
  // Sorted: [1,2,3,4,5]; p=0.5 → idx=2 → 3
  assert.equal(quantile([5, 1, 3, 2, 4], 0.5), 3);
  // p=0.25 → idx=1 → 2
  assert.equal(quantile([5, 1, 3, 2, 4], 0.25), 2);
  // p=0.75 → idx=3 → 4
  assert.equal(quantile([5, 1, 3, 2, 4], 0.75), 4);
});

test("quantile clamps out-of-range p", () => {
  assert.equal(quantile([1, 2, 3], 0), 1);
  assert.equal(quantile([1, 2, 3], 1), 3);
});

test("ci95 has low<mean<high for spread sample", () => {
  const c = ci95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(c.low < c.mean, `low=${c.low} mean=${c.mean}`);
  assert.ok(c.mean < c.high, `mean=${c.mean} high=${c.high}`);
  assert.equal(c.n, 10);
});

test("ci95 returns null-ish result for n<2", () => {
  assert.equal(ci95([]).n, 0);
  assert.equal(ci95([5]).n, 1);
});

test("welchTTest detects clearly separated samples (p<0.05)", () => {
  // Use samples with non-zero variance so the test exercises the t-statistic
  // path (zero-variance samples return p=1 by design).
  const r = welchTTest([1, 2, 1, 2, 1], [10, 11, 10, 11, 10]);
  assert.ok(r.p < 0.05, `p=${r.p}`);
  assert.ok(Math.abs(r.t) > 0);
});

test("welchTTest yields p>0.5 for identical samples", () => {
  const r = welchTTest([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
  assert.ok(r.p > 0.5, `p=${r.p}`);
});

test("welchTTest returns p=1 for zero-variance samples", () => {
  const r = welchTTest([5, 5, 5, 5], [5, 5, 5, 5]);
  assert.equal(r.p, 1);
  assert.equal(r.t, 0);
});

test("cohensD reflects standardized effect size", () => {
  // |d| should be large (clearly separated, similar spread).
  const d = cohensD([1, 2, 3], [10, 11, 12]);
  assert.ok(Math.abs(d) > 5, `|d|=${Math.abs(d)}`);
});

test("cohensD returns 0 for identical samples", () => {
  assert.equal(cohensD([1, 2, 3], [1, 2, 3]), 0);
});

test("pairedDelta flips sign when arrays are swapped", () => {
  const a = [10, 20, 30];
  const b = [5, 10, 15];
  const ab = pairedDelta(a, b);
  const ba = pairedDelta(b, a);
  assert.ok(ab.meanDelta < 0);
  assert.ok(ba.meanDelta > 0);
  assert.ok(Math.abs(ab.meanDelta + ba.meanDelta) < 1e-9);
  assert.ok(Math.abs(ab.medianDelta + ba.medianDelta) < 1e-9);
});

test("pairedDelta returns null for n<2", () => {
  assert.equal(pairedDelta([1], [2]), null);
});

test("summarize produces n/mean/stddev/median/ci95 shape", () => {
  const s = summarize([1, 2, 3, 4, 5]);
  assert.equal(s.n, 5);
  assert.equal(s.mean, 3);
  assert.equal(s.median, 3);
  assert.ok(s.stddev > 1.4 && s.stddev < 1.6);
  assert.ok(s.ci95.low < s.mean);
  assert.ok(s.ci95.high > s.mean);
});
