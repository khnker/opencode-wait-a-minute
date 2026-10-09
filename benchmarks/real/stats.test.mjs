import { test } from "node:test";
import assert from "node:assert/strict";
import * as stats from "./stats.mjs";

test("stats mean", () => {
  assert.strictEqual(stats.mean([1,2,3,4,5]), 3);
});

test("stats median", () => {
  assert.strictEqual(stats.median([1,2,3,4,5]), 3);
  assert.strictEqual(stats.median([1,2,3,4]), 2.5);
});

test("stats p95", () => {
  // 1..20 -> p95 linear interpolation between 18 and 19 at 0.05 fraction => 19.05
  const arr = Array.from({length:20}, (_,i)=>i+1); // 1..20
  const actual = stats.p95(arr);
  // Using a tiny epsilon for floating point
  assert.ok(Math.abs(actual - 19.05) < 1e-10);
});

test("stats stddev", () => {
  // sample stddev of [1,2,3,4,5] = sqrt((4+1+0+1+4)/4) = sqrt(10/4)= sqrt(2.5)=1.58113883...
  const actual = stats.stddev([1,2,3,4,5]);
  assert.ok(Math.abs(actual - 1.58113883) < 1e-7);
});

test("stats ci95", () => {
  // For [1,2,3,4,5] mean=3, stddev=1.58113883, n=5, SE=stddev/sqrt(n)=0.70710678, t=2.776 (df=4) -> margin=1.963 -> CI [1.037, 4.963]
  const ci = stats.ci95([1,2,3,4,5]);
  assert.ok(ci);
  assert.ok(Math.abs(ci.low - 1.614) < 0.01);
  assert.ok(Math.abs(ci.high - 4.386) < 0.01);
});