import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import plugin from "../../index.js";

const { effectiveTaskId, readActiveTaskIdFresh, writeActiveTaskId } = plugin;

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-session-task-"));
}

function makeTask(root, taskId, mtimeMs) {
  const dir = path.join(root, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const statePath = path.join(dir, "task.json");
  fs.writeFileSync(statePath, JSON.stringify({ phase: "PROPOSED" }));
  if (typeof mtimeMs === "number") {
    const date = new Date(mtimeMs);
    fs.utimesSync(statePath, date, date);
  }
  return statePath;
}

test("per-session binding wins over a foreign global pointer", () => {
  const root = makeRoot();
  writeActiveTaskId("task-a-sess-aaaaaaaa", root, { sessionId: "ses_A", projectRoot: root });
  writeActiveTaskId("task-b-sess-bbbbbbbb", root, { sessionId: "ses_B", projectRoot: root });

  assert.equal(
    readActiveTaskIdFresh(root, { sessionId: "ses_A", projectRoot: root }),
    "task-a-sess-aaaaaaaa",
  );
  assert.equal(
    readActiveTaskIdFresh(root, { sessionId: "ses_B", projectRoot: root }),
    "task-b-sess-bbbbbbbb",
  );
});

test("legacy session recovers its task by suffix when no binding exists", () => {
  const root = makeRoot();
  makeTask(root, "task-roadmap-sess-abcdefgh");
  writeActiveTaskId("task-subagent-sess-zzzzzzzz", root, { sessionId: "ses_Z", projectRoot: root });

  assert.equal(
    readActiveTaskIdFresh(root, { sessionId: "ses_abcdefgh", projectRoot: root }),
    "task-roadmap-sess-abcdefgh",
  );
});

test("legacy recovery picks the newest matching task", () => {
  const root = makeRoot();
  makeTask(root, "task-old-sess-abcdefgh", 1_000);
  makeTask(root, "task-new-sess-abcdefgh", 2_000);

  assert.equal(
    readActiveTaskIdFresh(root, { sessionId: "ses_abcdefgh", projectRoot: root }),
    "task-new-sess-abcdefgh",
  );
});

test("effectiveTaskId resolves the session task despite a foreign global pointer", () => {
  const root = makeRoot();
  makeTask(root, "task-roadmap-sess-abcdefgh");
  writeActiveTaskId("task-subagent-sess-zzzzzzzz", root, { sessionId: "ses_Z", projectRoot: root });

  const resolved = effectiveTaskId(
    { sessionID: "ses_abcdefgh" },
    new Map(),
    root,
    "continua",
    false,
  );
  assert.equal(resolved.taskId, "task-roadmap-sess-abcdefgh");
});

test("session-less reads keep the 60s TTL", () => {
  const root = makeRoot();
  fs.mkdirSync(path.join(root, ".wam"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".wam", "active-task"),
    JSON.stringify({ id: "task-stale", ts: Date.now() - 120_000 }),
  );

  assert.equal(readActiveTaskIdFresh(root, { projectRoot: root }), null);
});
