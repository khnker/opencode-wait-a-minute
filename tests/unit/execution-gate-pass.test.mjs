import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { getTaskState } from "../../src/skills/engine.js";

function writeConfig(root) {
  const configPath = path.join(root, "wam-config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    logging: false,
    taskLoop: { enabled: true, agents: { enabled: true } },
  }));
  process.env.WAM_CONFIG = configPath;
}

function makeClient(root, taskId, { fail = false } = {}) {
  const counts = {};
  return {
    calls: counts,
    session: {
      get: async () => ({ data: { directory: root, parentID: undefined } }),
      create: async () => ({ data: { id: `child-${Date.now()}` } }),
      prompt: async ({ body }) => {
        if (fail) throw new Error("prompt failed");
        const role = /WAM (\w+) role/.exec(body.system)?.[1];
        if (!role) throw new Error("role missing from prompt");
        counts[role] = (counts[role] || 0) + 1;
        const result = {
          taskId,
          invocationId: `${taskId}:${role}:${counts[role]}`,
          role,
          status: "COMPLETED",
          summary: `${role} done`,
          findings: [],
          decisions: [],
          artifacts: [],
          evidence: [],
          openQuestions: [],
          recommendations: [],
          limitations: [],
        };
        if (role === "REVIEWER") {
          result.review = { verdict: "ACCEPTED", findings: [], limitations: [] };
        }
        return { data: { parts: [{ type: "text", text: JSON.stringify(result) }] } };
      },
    },
  };
}

async function waitForGate(root, taskId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = getTaskState(taskId, root);
    if (state && !state.executionGate?.active) return state;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return getTaskState(taskId, root);
}

test("the early agent pass clears the gate after success", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-pass-ok-"));
  const taskId = `pass-ok-${Date.now()}`;
  const previousConfig = process.env.WAM_CONFIG;
  try {
    writeConfig(root);
    const client = makeClient(root, taskId);
    const hooks = await plugin({ directory: root, client, project: {}, $: {} });

    await hooks["chat.message"](
      {
        sessionID: "ses-pass-ok",
        messageID: "m1",
        message: { parts: [{ type: "text", text: "implementa el fix del login con tests" }] },
        taskId,
      },
      { message: {}, parts: [] },
    );

    const state = await waitForGate(root, taskId);
    assert.equal(state.executionGate?.active ?? false, false);
    assert.equal(state.agentRun?.status, "COMPLETED");
    assert.equal(state.agentRun?.verdict, "ACCEPTED");
  } finally {
    if (previousConfig === undefined) delete process.env.WAM_CONFIG;
    else process.env.WAM_CONFIG = previousConfig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the early agent pass clears the gate after failure", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-pass-fail-"));
  const taskId = `pass-fail-${Date.now()}`;
  const previousConfig = process.env.WAM_CONFIG;
  try {
    writeConfig(root);
    const client = makeClient(root, taskId, { fail: true });
    const hooks = await plugin({ directory: root, client, project: {}, $: {} });

    await hooks["chat.message"](
      {
        sessionID: "ses-pass-fail",
        messageID: "m1",
        message: { parts: [{ type: "text", text: "implementa el fix del login con tests" }] },
        taskId,
      },
      { message: {}, parts: [] },
    );

    const state = await waitForGate(root, taskId);
    assert.equal(state.executionGate?.active ?? false, false);
  } finally {
    if (previousConfig === undefined) delete process.env.WAM_CONFIG;
    else process.env.WAM_CONFIG = previousConfig;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
