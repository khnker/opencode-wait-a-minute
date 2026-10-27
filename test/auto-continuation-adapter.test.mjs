/**
 * Adapter test: session.idle → automatic completion loop.
 * Verifies that a rejected post-DONE review re-drives the same session
 * without waiting for a user message.
 *
 * Run: node --test --test-force-exit test/auto-continuation-adapter.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../index.js";

function setupTmp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-auto-loop-"));
  const taskId = "t1";
  const taskDir = path.join(tmp, ".wam", "tasks", taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(
    path.join(taskDir, "task.json"),
    JSON.stringify({
      phase: "IMPLEMENTING",
      contract: { status: "APPROVED", rigor: "NORMAL", unknowns: [], assumptions: [] },
      requirements: [{ id: "req-1", title: "falta implementar X", status: "pending", evidence: [] }],
      outcomeContract: {
        taskId,
        objective: "test",
        acceptanceCriteria: [{ id: "outcome-evaluation", description: "verified", mandatory: true }],
      },
    }),
  );
  fs.writeFileSync(
    path.join(tmp, ".wam", "active-task"),
    JSON.stringify({ id: taskId, ts: Date.now(), sessionId: "sess-1", projectRoot: tmp }),
  );
  return { tmp, taskId };
}

function fakeClient(text) {
  const calls = [];
  let resolvePrompt;
  const prompted = new Promise((resolve) => { resolvePrompt = resolve; });
  const client = {
    session: {
      messages: async () => [
        { info: { id: "msg-1", role: "assistant" }, parts: [{ type: "text", text }] },
      ],
      prompt: async (args) => {
        calls.push(args);
        resolvePrompt(args);
        return {};
      },
    },
  };
  return { client, calls, prompted };
}

const idle = (hooks, sessionID = "sess-1") =>
  hooks.event({ event: { type: "session.idle", properties: { sessionID } } });

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));

test("session.idle after a DONE claim re-drives the session", async () => {
  const { tmp, taskId } = setupTmp();
  const { client, calls, prompted } = fakeClient("Implementé todo. Listo, terminado.");
  const hooks = await pluginDefault({ directory: tmp, client, project: {}, $: {} });

  idle(hooks);
  const args = await Promise.race([prompted, timeout(1000)]);

  assert.equal(calls.length, 1);
  assert.equal(args.path.id, "sess-1");
  assert.match(args.body.parts[0].text, /req-1/);
  assert.match(args.body.parts[0].text, /auto-loop/);

  const state = JSON.parse(fs.readFileSync(path.join(tmp, ".wam", "tasks", taskId, "task.json"), "utf8"));
  assert.equal(state.autoLoop.attempts, 1);
  assert.equal(state.autoLoop.total, 1);
  assert.equal(state.autoLoop.lastMessageID, "msg-1");

  fs.rmSync(tmp, { recursive: true, force: true });
});

test("session.idle without a completion claim does not re-drive", async () => {
  const { tmp } = setupTmp();
  const { client, calls } = fakeClient("Necesito que elijas entre A y B.");
  const hooks = await pluginDefault({ directory: tmp, client, project: {}, $: {} });

  idle(hooks);
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(calls.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("autoLoop disabled by env override never re-drives", async () => {
  const { tmp } = setupTmp();
  const { client, calls } = fakeClient("Listo, terminado.");
  process.env.WAM_AUTO_LOOP = "0";
  try {
    const hooks = await pluginDefault({ directory: tmp, client, project: {}, $: {} });
    idle(hooks);
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(calls.length, 0);
  } finally {
    delete process.env.WAM_AUTO_LOOP;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
