import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  aggregatedStatePath,
  loadTaskState,
  saveTaskState,
  validateStateFile,
} from "../../src/state/task-state-file.js";

const makeRoot = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "wam-state-hardening-"));

const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

test("corrupt aggregated state fails loud instead of becoming empty", () => {
  const root = makeRoot();
  fs.mkdirSync(path.dirname(aggregatedStatePath(root)), { recursive: true });
  fs.writeFileSync(aggregatedStatePath(root), "{ not json");

  assert.throws(() => loadTaskState(root), /Corrupt WAM task-state\.json/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("saveTaskState writes atomically and leaves no temp files", () => {
  const root = makeRoot();
  saveTaskState(root, {
    version: "1",
    tasks: {
      t1: {
        id: "t1",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    },
  });

  const dir = path.dirname(aggregatedStatePath(root));
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes(".tmp-"));
  assert.deepEqual(leftovers, []);
  const written = JSON.parse(fs.readFileSync(aggregatedStatePath(root), "utf-8"));
  assert.equal(written.tasks.t1.status, "pending");
  fs.rmSync(root, { recursive: true, force: true });
});

test("unknown per-task status is surfaced, not silently dropped", () => {
  const root = makeRoot();
  write(path.join(root, ".wam", "tasks", "bad", "task.json"), {
    id: "bad",
    status: "NOPE",
    createdAt: new Date().toISOString(),
  });
  write(aggregatedStatePath(root), { version: "1", tasks: {} });

  assert.throws(() => loadTaskState(root), /invalid status/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test("an empty task map is structurally valid", () => {
  assert.equal(validateStateFile({ version: "1", tasks: {} }).valid, true);
});
