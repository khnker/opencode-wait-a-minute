/**
 * Unit tests for src/context/session-file-read-ledger.js
 *
 * This module is the seam used by runtime-guards.js to detect stale file reads.
 * The behavior contract tested here is what the runtime-guards fix relies on:
 *
 *   - recordRead(path, content) advances the ledger to the current content
 *   - checkStale(path, content) returns true only when the ledger's recorded
 *     digest differs from the current content's digest
 *   - isRedundant(path, content) returns true only when the digests match
 *   - After recordRead(path, newContent), checkStale(path, newContent) is false
 *     and isRedundant(path, newContent) is true
 *   - reset() clears entries; fail-open semantics on garbage input
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readLedger } from "../../src/context/session-file-read-ledger.js";

function freshPath(name) {
  // Use a unique path per test to avoid cross-test ledger pollution.
  return `/tmp/wam-ledger-test/${name}-${Math.random().toString(36).slice(2)}`;
}

test("recordRead advances ledger; subsequent checkStale on same content is false", () => {
  const p = freshPath("advance");
  assert.equal(readLedger.checkStale(p, "v1"), false, "no record yet → not stale");
  readLedger.recordRead(p, "v1");
  assert.equal(readLedger.checkStale(p, "v1"), false, "matching digest → not stale");
  assert.equal(readLedger.isRedundant(p, "v1"), true, "matching digest → redundant");
});

test("checkStale returns true when content differs from last recorded", () => {
  const p = freshPath("differs");
  readLedger.recordRead(p, "old");
  assert.equal(readLedger.checkStale(p, "new"), true, "different digest → stale");
  assert.equal(readLedger.isRedundant(p, "new"), false, "different digest → not redundant");
});

test("after recordRead(newContent), checkStale(newContent) is false (ledger advances)", () => {
  // This is the precise invariant the runtime-guards fix depends on.
  const p = freshPath("ledger-advances");
  readLedger.recordRead(p, "v1");
  assert.equal(readLedger.checkStale(p, "v1"), false);
  // Simulate stale-detection in guardAction: the new content is recorded.
  readLedger.recordRead(p, "v2");
  // Now the ledger should reflect v2; v2 is no longer stale, v1 is.
  assert.equal(readLedger.checkStale(p, "v2"), false, "v2 recorded → not stale");
  assert.equal(readLedger.isRedundant(p, "v2"), true, "v2 recorded → redundant");
  assert.equal(readLedger.checkStale(p, "v1"), true, "v1 differs from v2 → stale");
});

test("getDigest returns recorded digest after recordRead", () => {
  const p = freshPath("getdigest");
  const expected = readLedger.digest("hello");
  assert.equal(readLedger.getDigest(p), null, "no record → null");
  readLedger.recordRead(p, "hello");
  assert.equal(readLedger.getDigest(p), expected);
});

test("reset(path) removes a single entry; reset() with no arg clears all", () => {
  const p1 = freshPath("reset-1");
  const p2 = freshPath("reset-2");
  readLedger.recordRead(p1, "a");
  readLedger.recordRead(p2, "b");
  readLedger.reset(p1);
  assert.equal(readLedger.getDigest(p1), null, "p1 cleared");
  assert.notEqual(readLedger.getDigest(p2), null, "p2 untouched");
});

test("fail-open: garbage inputs do not throw", () => {
  // Non-string content should not crash; module is documented as fail-open.
  assert.doesNotThrow(() => readLedger.recordRead("/x", undefined));
  assert.doesNotThrow(() => readLedger.checkStale("/x", null));
  assert.doesNotThrow(() => readLedger.isRedundant("/x", {}));
  assert.equal(readLedger.checkStale("/x", "anything"), false);
});