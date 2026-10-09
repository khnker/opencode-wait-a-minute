import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalize,
  factCoverage,
  parseJudgeJson,
  aggregate,
  pairedQualityDelta,
  extractFirstJsonObject,
  extractFinalAnswer,
  ANSWER_INSTRUCTION
} from "./scoring.mjs";

test("normalize: trim, lowercase, collapse whitespace", () => {
  assert.equal(normalize("  Hello   World  "), "hello world");
  assert.equal(normalize(""), "");
  assert.equal(normalize(null), "");
  assert.equal(normalize(123), "");
});

test("factCoverage: exact substring match", () => {
  const r = factCoverage("the answer is Q1:R3 here", ["Q1:R3"]);
  assert.equal(r.score, 1);
  assert.equal(r.matched.length, 1);
  assert.equal(r.missing.length, 0);
  assert.equal(r.total, 1);
});

test("factCoverage: missing fact", () => {
  const r = factCoverage("nothing relevant", ["Q9:R9"]);
  assert.equal(r.score, 0);
  assert.equal(r.matched.length, 0);
  assert.equal(r.missing.length, 1);
});

test("factCoverage: {any} variant matches if any variant present", () => {
  const r1 = factCoverage("there are SEVEN items", [{ any: ["7", "seven"] }]);
  assert.equal(r1.score, 1);
  const r2 = factCoverage("there are 7 items", [{ any: ["7", "seven"] }]);
  assert.equal(r2.score, 1);
  const r3 = factCoverage("there are three items", [{ any: ["7", "seven"] }]);
  assert.equal(r3.score, 0);
});

test("factCoverage: empty requiredFacts returns score=1", () => {
  const r = factCoverage("anything at all", []);
  assert.equal(r.score, 1);
  assert.equal(r.matched.length, 0);
  assert.equal(r.missing.length, 0);
  assert.equal(r.total, 0);
});

test("factCoverage: normalization ignores case and whitespace", () => {
  const r = factCoverage("Hello   Q1:R3   World", ["q1:r3"]);
  assert.equal(r.score, 1);
});

test("factCoverage: multiple required facts – mixed presence", () => {
  // Use a unique sentinel so the response text cannot accidentally contain
  // the "missing" facts (previous test fixture accidentally had Q1:R9).
  const required = ["Q-AAA-1", "Q-BBB-2", "Q-CCC-3"];
  const response = "Only Q-AAA-1 is present here, that is all.";
  const r = factCoverage(response, required);
  assert.equal(r.total, 3);
  assert.equal(r.matched.length, 1);
  assert.equal(r.missing.length, 2);
  // matched + missing = total
  assert.equal(r.matched.length + r.missing.length, r.total);
  assert.equal(r.score, 1 / 3);
});

test("parseJudgeJson: plain JSON", () => {
  const v = parseJudgeJson('{"score": 75, "pass": true, "reason": "ok"}');
  assert.equal(v.score, 75);
  assert.equal(v.pass, true);
  assert.equal(v.reason, "ok");
});

test("parseJudgeJson: fenced ```json wrapper", () => {
  const v = parseJudgeJson("```json\n{\"score\": 42, \"pass\": false, \"reason\": \"weak\"}\n```");
  assert.equal(v.score, 42);
  assert.equal(v.pass, false);
  assert.equal(v.reason, "weak");
});

test("parseJudgeJson: with surrounding prose", () => {
  const v = parseJudgeJson(
    "Sure! Here is my eval:\n```json\n{\"score\": 88, \"pass\": true, \"reason\": \"good\"}\n```\nthanks"
  );
  assert.equal(v.score, 88);
  assert.equal(v.pass, true);
  assert.equal(v.reason, "good");
});

test("parseJudgeJson: malformed returns null", () => {
  assert.equal(parseJudgeJson("not json at all"), null);
  assert.equal(parseJudgeJson(""), null);
  assert.equal(parseJudgeJson("{ broken json"), null);
});

test("parseJudgeJson: clamps score to 0..100", () => {
  const hi = parseJudgeJson('{"score": 999, "pass": true, "reason": "r"}');
  assert.equal(hi.score, 100);
  const lo = parseJudgeJson('{"score": -50, "pass": false, "reason": "r"}');
  assert.equal(lo.score, 0);
});

test("parseJudgeJson: coerces non-boolean pass", () => {
  const v = parseJudgeJson('{"score": 60, "pass": "yes", "reason": "r"}');
  assert.equal(v.pass, true);
  const v2 = parseJudgeJson('{"score": 10, "pass": "no", "reason": "r"}');
  assert.equal(v2.pass, false);
});

test("extractFirstJsonObject: finds first balanced object", () => {
  const o = extractFirstJsonObject('prefix {"a":1,"b":2} suffix');
  assert.deepEqual(o, { a: 1, b: 2 });
});

test("aggregate: trivial stats", () => {
  const r = aggregate([10, 20, 30, 40]);
  assert.equal(r.n, 4);
  assert.equal(r.mean, 25);
  assert.equal(r.median, 25);
  assert.equal(r.min, 10);
  assert.equal(r.max, 40);
});

test("aggregate: ignores non-finite, empty -> zeros", () => {
  assert.equal(aggregate([]).n, 0);
  assert.equal(aggregate([null, undefined, NaN, "x"]).n, 0);
  const r = aggregate([5, NaN, 10]);
  assert.equal(r.n, 2);
  assert.equal(r.mean, 7.5);
});

test("pairedQualityDelta: wins / losses / ties", () => {
  const r = pairedQualityDelta([1, 1, 1, 1], [2, 2, 1, 0]);
  assert.equal(r.n, 4);
  assert.equal(r.wins, 2);
  assert.equal(r.losses, 1);
  assert.equal(r.ties, 1);
  assert.ok(r.meanDelta > 0);
});

test("pairedQualityDelta: equal values are ties (epsilon)", () => {
  const r = pairedQualityDelta([1, 2, 3], [1.0000000001, 2, 2.9999999999]);
  assert.equal(r.wins, 0);
  assert.equal(r.losses, 0);
  assert.equal(r.ties, 3);
});

test("pairedQualityDelta: empty arrays", () => {
  const r = pairedQualityDelta([], []);
  assert.equal(r.n, 0);
  assert.equal(r.wins + r.losses + r.ties, 0);
});

test("extractFinalAnswer: returns text after the FINAL ANSWER marker", () => {
  const text = "Let me think... the answer is unclear.\nFINAL ANSWER: Q1:-requirement[3]";
  assert.equal(extractFinalAnswer(text), "Q1:-requirement[3]");
});

test("extractFinalAnswer: marker is case-insensitive and takes the LAST one", () => {
  const text = "final answer: wrong\nsome more reasoning\nFinal Answer: right";
  assert.equal(extractFinalAnswer(text), "right");
});

test("extractFinalAnswer: no marker falls back to whole trimmed text", () => {
  assert.equal(extractFinalAnswer("  just the answer  "), "just the answer");
});

test("extractFinalAnswer: non-string is empty", () => {
  assert.equal(extractFinalAnswer(null), "");
  assert.equal(extractFinalAnswer(undefined), "");
  assert.equal(extractFinalAnswer(42), "");
});

test("ANSWER_INSTRUCTION mentions the FINAL ANSWER marker", () => {
  assert.ok(ANSWER_INSTRUCTION.includes("FINAL ANSWER:"));
});
