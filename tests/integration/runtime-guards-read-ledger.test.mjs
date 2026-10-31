/**
 * Integration tests for src/execution/runtime-guards.js around the
 * Session File Read Ledger.
 *
 * The recent fix added `readLedger.recordRead(path, content)` inside the
 * stale-read branch so that, once the ledger flags a read as stale, the
 * ledger advances to the new content. Subsequent reads of the same
 * (now-recorded) content must therefore NOT be flagged stale again.
 *
 * These tests verify that contract end-to-end through guardAction().
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { guardAction } from "../../src/execution/runtime-guards.js";
import { readLedger } from "../../src/context/session-file-read-ledger.js";

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-guard-ledger-"));
  const file = path.join(root, "subject.txt");
  const taskId = "guard-ledger-task";
  return {
    root,
    file,
    taskId,
    cleanup: () => {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) {}
    },
  };
}

test("guardAction: first read records the digest (no stale flag)", async () => {
  const { file, taskId, cleanup } = setup();
  try {
    fs.writeFileSync(file, "v1");
    const r = await guardAction("read", { path: file }, "/tmp", taskId);
    assert.equal(r.allowed, true);
    // Either SAFE (no entry) or INFO (redundant) — both are non-blocking.
    assert.ok(["SAFE", "INFO"].includes(r.level), `unexpected level: ${r.level}`);
    // Ledger must now reflect v1.
    assert.notEqual(readLedger.getDigest(file), null);
  } finally {
    cleanup();
  }
});

test("guardAction: read of unchanged file surfaces redundant INFO nudge", async () => {
  const { file, taskId, cleanup } = setup();
  try {
    fs.writeFileSync(file, "v1");
    await guardAction("read", { path: file }, "/tmp", taskId);
    // Second read of unchanged content → redundant (not stale).
    const r = await guardAction("read", { path: file }, "/tmp", taskId);
    assert.equal(r.allowed, true, "redundant read is allowed (with nudge)");
    assert.equal(r.level, "INFO", "redundant read surfaces INFO");
    assert.ok(r.nudge, "redundant read should carry a nudge");
  } finally {
    cleanup();
  }
});

test("guardAction: edit on stale file is advisory (no bloquea) and ledger advances", async () => {
  const { file, taskId, cleanup } = setup();
  try {
    fs.writeFileSync(file, "v1");
    await guardAction("read", { path: file }, "/tmp", taskId);
    const digestBefore = readLedger.getDigest(file);
    assert.notEqual(digestBefore, null, "ledger seeded by initial read");

    fs.writeFileSync(file, "v2");
    const r = await guardAction("edit", { path: file }, "/tmp", taskId);
    assert.equal(r.allowed, true, "edit on stale file se avisa, no se bloquea");
    assert.equal(r.level, "ADVISORY");
    assert.match(r.reason, /stale/i);
    assert.match(r.recommendation, /^Recomendación: /);

    // The fix: after the stale-edit block, the ledger must advance to v2.
    const digestAfter = readLedger.getDigest(file);
    assert.notEqual(digestAfter, null);
    assert.notEqual(digestAfter, digestBefore, "ledger must advance to new content after stale-edit block");
  } finally {
    cleanup();
  }
});

test("guardAction: unknown tools stay advisory even when file ledger advances", async () => {
  const { file, taskId, cleanup } = setup();
  try {
    fs.writeFileSync(file, "v1");
    await guardAction("read", { path: file }, "/tmp", taskId);
    const r = await guardAction("mystery-tool", { path: file }, "/tmp", taskId);
    assert.equal(r.allowed, true);
    assert.equal(r.level, "ADVISORY");
    assert.match(r.reason, /catalog/i);
    assert.match(r.recommendation, /^Recomendación: /);
  } finally {
    cleanup();
  }
});