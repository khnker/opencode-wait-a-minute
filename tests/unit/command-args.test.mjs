import test from "node:test";
import assert from "node:assert/strict";
import { stripWrappingQuotes } from "../../src/shared/command-args.js";

test("stripWrappingQuotes removes matching double quotes", () => {
  assert.equal(stripWrappingQuotes('"completion gate"'), "completion gate");
});

test("stripWrappingQuotes removes matching single quotes", () => {
  assert.equal(stripWrappingQuotes("'x'"), "x");
});

test("stripWrappingQuotes leaves unmatched quotes unchanged", () => {
  assert.equal(stripWrappingQuotes('"completion gate'), '"completion gate');
  assert.equal(stripWrappingQuotes("completion gate'"), "completion gate'");
});

test("stripWrappingQuotes leaves plain text unchanged", () => {
  assert.equal(stripWrappingQuotes("completion gate"), "completion gate");
});

test("stripWrappingQuotes is safe for empty and undefined values", () => {
  assert.equal(stripWrappingQuotes(""), "");
  assert.equal(stripWrappingQuotes(undefined), "");
  assert.equal(stripWrappingQuotes(null), "");
});
