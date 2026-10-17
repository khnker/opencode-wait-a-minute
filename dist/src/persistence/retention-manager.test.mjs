/**
 * Tests for retention-manager.js — archiveAndPruneSingleTask + pruneCompletedTasks.
 * Run: node --test src/persistence/retention-manager.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { archiveAndPruneSingleTask } from "./retention-manager.js";
import { loadTask, listTasks } from "../state/task-store.js";
import { createState } from "../state/task-state.js";
import { saveTask } from "../state/task-store.js";

function makeTempRoot() {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "wam-rm-test-"),
  );
  fs.mkdirSync(path.join(dir, ".wam", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".wam", "archive", "tasks"), {
    recursive: true,
  });
  return dir;
}

function writeTask(root, taskId, overrides = {}) {
  const state = {
    ...createState(taskId),
    status: "completed",
    completedAt: Date.now(),
    ...overrides,
  };
  saveTask(taskId, state, root);
  return state;
}

test("archiveAndPruneSingleTask archives and removes task dir", async () => {
  const root = makeTempRoot();
  writeTask(root, "task-1", { title: "T1" });

  const result = await archiveAndPruneSingleTask("task-1", root);
  assert.equal(result.archived, true, "should archive");
  assert.ok(result.archiveDir, "archiveDir should be set");
  assert.equal(result.pruned, true, "should prune");
  assert.deepEqual(result.errors, [], `unexpected errors: ${JSON.stringify(result.errors)}`);

  // Task dir removed from .wam/tasks/
  assert.equal(
    fs.existsSync(path.join(root, ".wam", "tasks", "task-1")),
    false,
    "task dir must be removed",
  );
  assert.deepEqual(listTasks(root), [], "listTasks must be empty");

  // Archive summary exists
  const summaryPath = path.join(result.archiveDir, "task-summary.json");
  assert.equal(fs.existsSync(summaryPath), true, "archive summary must exist");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
  assert.equal(summary.taskId, "task-1");
  assert.equal(summary.title, "T1");
});

test("archiveAndPruneSingleTask is best-effort on missing task", async () => {
  const root = makeTempRoot();
  const result = await archiveAndPruneSingleTask("nope", root);
  assert.equal(result.archived, false);
  assert.equal(result.pruned, false);
  assert.ok(result.errors.length > 0, "should report error");
});

test("complete() triggers archive/prune via task-lifecycle", async () => {
  const root = makeTempRoot();
  writeTask(root, "task-complete", { phase: "RUNNING" });

  // Allow the async archive/prune to settle.
  await new Promise((r) => setTimeout(r, 50));

  const { complete } = await import("../state/task-lifecycle.js");
  complete("task-complete", root);

  // Wait for the fire-and-forget archive/prune to finish.
  await new Promise((r) => setTimeout(r, 100));

  assert.equal(
    fs.existsSync(path.join(root, ".wam", "tasks", "task-complete")),
    false,
    "task dir must be removed after complete()",
  );
  const archived = fs.readdirSync(
    path.join(root, ".wam", "archive", "tasks"),
  );
  assert.ok(
    archived.some((d) => d.startsWith("task-complete-")),
    "archive dir must exist",
  );
});

test("switchTo to DONE triggers archive/prune", async () => {
  const root = makeTempRoot();
  writeTask(root, "task-switch", { phase: "RUNNING" });

  const { switchTo } = await import("../state/task-lifecycle.js");
  switchTo("task-switch", "DONE", root);

  await new Promise((r) => setTimeout(r, 100));

  assert.equal(
    fs.existsSync(path.join(root, ".wam", "tasks", "task-switch")),
    false,
    "task dir must be removed after switchTo DONE",
  );
});

test("switchTo to non-DONE phase does not prune", async () => {
  const root = makeTempRoot();
  writeTask(root, "task-pause", { phase: "RUNNING" });

  const { switchTo } = await import("../state/task-lifecycle.js");
  switchTo("task-pause", "WAITING", root);

  await new Promise((r) => setTimeout(r, 50));

  assert.equal(
    fs.existsSync(path.join(root, ".wam", "tasks", "task-pause")),
    true,
    "task dir must remain for non-DONE transitions",
  );
});