import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadTaskState } from "../../src/state/task-state-file.js";

function writeTask(root, taskId, task) {
  const dir = path.join(root, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "task.json"), JSON.stringify(task, null, 2));
}

test("phase-based live task files are skipped by the runner aggregate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-schema-"));
  writeTask(root, "live-task", {
    phase: "PROPOSED",
    contract: { status: "PROPOSED", requirements: [] },
    requirements: [],
  });

  const state = loadTaskState(root);
  assert.deepEqual(state.tasks, {});
  fs.rmSync(root, { recursive: true, force: true });
});

test("an actual invalid status still fails loud", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-schema-"));
  writeTask(root, "bad-task", {
    id: "bad-task",
    status: "NOPE",
    createdAt: new Date().toISOString(),
  });

  assert.throws(() => loadTaskState(root), /invalid status/i);
  fs.rmSync(root, { recursive: true, force: true });
});
