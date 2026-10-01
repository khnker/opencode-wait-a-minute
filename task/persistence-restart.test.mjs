/**
 * Task persistence restart test — verifies persisted state reloads deterministically,
 * terminal phase is fail-closed against resurrection, corrupt JSON fails closed, and
 * switchTo on a missing task throws.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as lifecycle from "./task-lifecycle.js";
import { loadTask, taskFilePath } from "./task-store.js";

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-task-"));
}

test("create → loadTask reloads the persisted state from disk", () => {
  const root = mkRoot();
  try {
    const created = lifecycle.create("t", root);
    const loaded = loadTask("t", root);
    assert.ok(loaded, "loadTask should return persisted state");
    assert.equal(loaded.taskId, created.taskId);
    assert.equal(loaded.phase, created.phase);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("complete → loadTask.phase === DONE; switchTo non-DONE throws", () => {
  const root = mkRoot();
  try {
    lifecycle.create("t", root);
    lifecycle.complete("t", root);
    assert.equal(loadTask("t", root).phase, "DONE");
    assert.throws(
      () => lifecycle.switchTo("t", "WAITING", root),
      /cannot transition from terminal phase/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("complete (DONE→DONE) stays idempotent — no throw", () => {
  const root = mkRoot();
  try {
    lifecycle.create("t", root);
    lifecycle.complete("t", root);
    assert.doesNotThrow(() => lifecycle.complete("t", root));
    assert.equal(loadTask("t", root).phase, "DONE");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("listTasks returns deterministic sorted directory list", async () => {
  const root = mkRoot();
  try {
    lifecycle.create("b", root);
    lifecycle.create("a", root);
    const { listTasks } = await import("./task-store.js");
    assert.deepEqual(listTasks(root).sort(), ["a", "b"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("corrupt JSON → loadTask returns null (fail-closed)", () => {
  const root = mkRoot();
  try {
    const file = taskFilePath("bad", root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{not-valid-json");
    const loaded = loadTask("bad", root);
    assert.equal(loaded, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("switchTo on missing task throws", () => {
  const root = mkRoot();
  try {
    assert.throws(
      () => lifecycle.switchTo("missing", "WAITING", root),
      /not found/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resume is read-only — does not mutate persisted state", () => {
  const root = mkRoot();
  try {
    lifecycle.create("t", root);
    const before = fs.readFileSync(taskFilePath("t", root), "utf-8");
    const resumed = lifecycle.resume("t", root);
    const after = fs.readFileSync(taskFilePath("t", root), "utf-8");
    assert.equal(before, after, "resume must not modify the on-disk JSON");
    assert.ok(resumed, "resume returns normalized state");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});