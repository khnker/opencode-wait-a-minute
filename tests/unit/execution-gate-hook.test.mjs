import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { getTaskState, persistTaskState } from "../../src/skills/engine.js";
import { createLoopState, saveLoopState } from "../../src/state/loop-state.js";

test("tool.execute.before blocks main-session mutations while the gate is active", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-hook-"));
  const taskId = "task-gate-hook";
  const sessionID = "ses-gate-hook";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", requirements: ["change"] },
      requirements: [{ id: "req-1", title: "change", status: "pending", evidence: [] }],
      executionGate: { active: true, reason: "agent-loop", ownerPid: process.pid, startedAt: new Date().toISOString() },
    }, root);
    plugin.writeActiveTaskId(taskId, root, { sessionId: sessionID, projectRoot: root });

    const hooks = await plugin({ directory: root, client: {}, project: {}, $: {} });

    await assert.rejects(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
      /ediciones están bloqueadas/,
    );

    await assert.rejects(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "bash" },
        { args: { command: "printf 'ok\\n' > /tmp/x.txt" } },
      ),
      /ediciones están bloqueadas/,
    );

    await assert.doesNotReject(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "read", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tool.execute.before gates non-WAM subagents but exempts WAM agent sessions", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-subagent-"));
  const taskId = "task-gate-subagent";
  const parentSession = "ses-gate-parent";
  const workerSession = "ses-gate-worker";
  const wamSession = "ses-gate-wam";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", requirements: ["change"] },
      requirements: [{ id: "req-1", title: "change", status: "pending", evidence: [] }],
      executionGate: { active: true, reason: "agent-loop", ownerPid: process.pid, startedAt: new Date().toISOString() },
    }, root);
    plugin.writeActiveTaskId(taskId, root, { sessionId: parentSession, projectRoot: root });

    const client = {
      session: {
        get: async ({ sessionID }) => ({
          data: {
            directory: root,
            parentID: parentSession,
            title: sessionID === wamSession ? "WAM ANALYST task-gate-subagent x:ANALYST:1" : "Fast Agent",
          },
        }),
      },
    };
    const hooks = await plugin({ directory: root, client, project: {}, $: {} });

    await assert.rejects(
      () => hooks["tool.execute.before"](
        { sessionID: workerSession, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
      /ediciones están bloqueadas/,
    );

    await assert.doesNotReject(
      () => hooks["tool.execute.before"](
        { sessionID: wamSession, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tool.execute.before releases a gate left behind by a previous process", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-stale-"));
  const taskId = "task-gate-stale";
  const sessionID = "ses-gate-stale";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", requirements: ["change"] },
      requirements: [{ id: "req-1", title: "change", status: "pending", evidence: [] }],
      executionGate: { active: true, reason: "agent-loop", ownerPid: process.pid - 1 },
    }, root);
    plugin.writeActiveTaskId(taskId, root, { sessionId: sessionID, projectRoot: root });

    const hooks = await plugin({ directory: root, client: {}, project: {}, $: {} });

    await assert.doesNotReject(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
    );

    const state = getTaskState(taskId, root);
    assert.equal(state.executionGate.active, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tool.execute.before releases a same-process gate once its loop is terminal", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-orphan-"));
  const taskId = "task-gate-orphan";
  const sessionID = "ses-gate-orphan";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", requirements: ["change"] },
      requirements: [{ id: "req-1", title: "change", status: "pending", evidence: [] }],
      executionGate: { active: true, reason: "agent-loop", ownerPid: process.pid, startedAt: new Date().toISOString() },
    }, root);
    const loop = createLoopState({ taskId, sessionId: sessionID });
    saveLoopState(taskId, root, { ...loop, status: "STOPPED", stopReason: "no-progress", lastDecision: "STOP_STAGNATION" });
    plugin.writeActiveTaskId(taskId, root, { sessionId: sessionID, projectRoot: root });

    const hooks = await plugin({ directory: root, client: {}, project: {}, $: {} });

    await assert.doesNotReject(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
    );

    assert.equal(getTaskState(taskId, root).executionGate.active, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tool.execute.before keeps a same-process gate while its loop is running", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-running-"));
  const taskId = "task-gate-running";
  const sessionID = "ses-gate-running";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", requirements: ["change"] },
      requirements: [{ id: "req-1", title: "change", status: "pending", evidence: [] }],
      executionGate: { active: true, reason: "agent-loop", ownerPid: process.pid, startedAt: new Date().toISOString() },
    }, root);
    const loop = createLoopState({ taskId, sessionId: sessionID });
    saveLoopState(taskId, root, { ...loop, status: "RUNNING" });
    plugin.writeActiveTaskId(taskId, root, { sessionId: sessionID, projectRoot: root });

    const hooks = await plugin({ directory: root, client: {}, project: {}, $: {} });

    await assert.rejects(
      () => hooks["tool.execute.before"](
        { sessionID, tool: "write", args: { filePath: "x.js" } },
        { args: { filePath: "x.js" } },
      ),
      /ediciones están bloqueadas/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
