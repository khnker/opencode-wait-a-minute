import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import plugin from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";
import { shouldRunTaskAgentPass } from "../../src/execution/task-agent-run.js";

const { effectiveTaskId, readActiveTaskIdFresh, writeActiveTaskId } = plugin;

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-session-task-"));
}

function makeTask(root, taskId, mtimeMs, phase = "PROPOSED") {
  const dir = path.join(root, ".wam", "tasks", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const statePath = path.join(dir, "task.json");
  fs.writeFileSync(statePath, JSON.stringify({ phase }));
  if (typeof mtimeMs === "number") {
    const date = new Date(mtimeMs);
    fs.utimesSync(statePath, date, date);
  }
  return statePath;
}

function isTaskDone(root) {
  return (id) => getTaskState(id, root)?.phase === "DONE";
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

test("a new instruction does not reuse a cached DONE task", () => {
  const root = makeRoot();
  const sessionID = "ses_done0001";
  const doneId = "task-old-work-sess-done0001";
  makeTask(root, doneId, undefined, "DONE");
  const sessionTasks = new Map([[sessionID, doneId]]);

  const resolved = effectiveTaskId(
    { sessionID },
    sessionTasks,
    root,
    "Implementar un modulo nuevo de reportes",
    false,
    isTaskDone(root),
  );

  assert.notEqual(resolved.taskId, doneId);
  makeTask(root, resolved.taskId, undefined, "PROPOSED");
  const nextState = getTaskState(resolved.taskId, root);
  assert.equal(shouldRunTaskAgentPass(nextState), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a new instruction does not reuse an active-only DONE task", () => {
  const root = makeRoot();
  const sessionID = "ses_done0002";
  const doneId = "task-old-work-sess-done0002";
  makeTask(root, doneId, undefined, "DONE");
  writeActiveTaskId(doneId, root, { sessionId: sessionID, projectRoot: root });

  const resolved = effectiveTaskId(
    { sessionID },
    new Map(),
    root,
    "Implementar otro modulo de facturacion",
    false,
    isTaskDone(root),
  );

  assert.notEqual(resolved.taskId, doneId);
  fs.rmSync(root, { recursive: true, force: true });
});

test("continuation and empty prompts still reuse a DONE task", () => {
  const root = makeRoot();
  const sessionID = "ses_done0003";
  const doneId = "task-old-work-sess-done0003";
  makeTask(root, doneId, undefined, "DONE");
  const isDone = isTaskDone(root);

  for (const prompt of ["continua", "", "WAM task loop: continue the task", "[wam auto-loop] Continuá hasta que el gate no encuentre nada más."]) {
    const sessionTasks = new Map([[sessionID, doneId]]);
    const resolved = effectiveTaskId({ sessionID }, sessionTasks, root, prompt, false, isDone);
    assert.equal(resolved.taskId, doneId);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test("a new instruction never reuses a DONE task in the session namespace", () => {
  const root = makeRoot();
  const sessionID = "ses_done0004";
  const doneId = `ses-${sessionID}`;
  makeTask(root, doneId, undefined, "DONE");
  const sessionTasks = new Map([[sessionID, doneId]]);

  const resolved = effectiveTaskId({ sessionID }, sessionTasks, root, "make", false, isTaskDone(root));

  assert.equal(resolved.taskId, `${doneId}-2`);
  fs.rmSync(root, { recursive: true, force: true });
});
test("a new instruction never reuses a cold DONE task in the session namespace", () => {
  const root = makeRoot();
  const sessionID = "ses_done0005";
  const doneId = `ses-${sessionID}`;
  makeTask(root, doneId, undefined, "DONE");

  const resolved = effectiveTaskId({ sessionID }, new Map(), root, "make", false, isTaskDone(root));

  assert.equal(resolved.taskId, `${doneId}-2`);
  fs.rmSync(root, { recursive: true, force: true });
});
