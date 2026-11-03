import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { persistTaskState } from "../../src/skills/engine.js";

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
      executionGate: { active: true, reason: "agent-loop" },
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
      executionGate: { active: true, reason: "agent-loop" },
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
