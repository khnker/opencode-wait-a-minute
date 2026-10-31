/**
 * Adapter test: session.idle → post-DONE review under the advisory contract.
 * The gate never blocks; a completion claim with an advisory gate still
 * re-drives, because auto-continuation is automation, not friction.
 *
 * Run: node --test --test-force-exit test/auto-continuation-adapter.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../index.js";
import { planAutoContinuation } from "../src/execution/auto-continuation.js";

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
  const messageReads = [];
  let resolvePrompt;
  const prompted = new Promise((resolve) => { resolvePrompt = resolve; });
  const client = {
    session: {
      messages: async (args) => {
        messageReads.push(args);
        return [
          { info: { id: "msg-1", role: "assistant" }, parts: [{ type: "text", text }] },
        ];
      },
      prompt: async (args) => {
        calls.push(args);
        resolvePrompt(args);
        return {};
      },
    },
  };
  return { client, calls, messageReads, prompted };
}

const idle = (hooks, sessionID = "sess-1") =>
  hooks.event({ event: { type: "session.idle", properties: { sessionID } } });

test("session.idle after a DONE claim re-drives on the advisory gate", async () => {
  const { tmp, taskId } = setupTmp();
  const { client, calls, messageReads } = fakeClient("Implementé todo. Listo, terminado.");
  const hooks = await pluginDefault({ directory: tmp, client, project: {}, $: {} });

  idle(hooks);
  await new Promise((resolve) => setTimeout(resolve, 150));

  // The adapter still runs the post-DONE review (it reads the last message)…
  assert.ok(messageReads.length >= 1, "session.idle should inspect the last assistant message");
  // …and a DONE claim with pending work re-drives: the gate is advisory (it
  // never blocks), but the auto-loop still sends the validation back as a
  // synthetic [wam auto-loop] turn.
  assert.equal(calls.length, 1, "session.idle should re-drive once for a DONE claim");
  const body = calls[0].body;
  assert.equal(body.parts.length, 1);
  assert.equal(body.parts[0].synthetic, true, "the auto-loop turn must not impersonate the user");
  assert.match(body.parts[0].text, /^\[wam auto-loop\]/);

  const state = JSON.parse(fs.readFileSync(path.join(tmp, ".wam", "tasks", taskId, "task.json"), "utf8"));
  assert.equal(state.autoLoop.attempts, 1);
  assert.equal(state.autoLoop.total, 1);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test("auto-loop planner re-drives the session when the gate is advisory", () => {
  const plan = planAutoContinuation({
    state: {},
    gate: { blocked: false, advisory: true, pending: ["req-1: falta implementar X"] },
    assistantText: "Implementé todo. Listo, terminado.",
    messageID: "msg-1",
  });

  assert.equal(plan.continue, true);
  assert.match(plan.prompt, /req-1/);
  assert.match(plan.prompt, /auto-loop/);
  assert.equal(plan.nextAutoLoop.attempts, 1);
  assert.equal(plan.nextAutoLoop.total, 1);
  assert.equal(plan.nextAutoLoop.lastMessageID, "msg-1");
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
