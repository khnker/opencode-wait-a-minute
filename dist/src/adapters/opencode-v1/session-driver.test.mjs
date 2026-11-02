import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { driveTaskLoop, buildLoopPrompt, DEFAULT_TASK_LOOP_CONFIG } from "./session-driver.js";
import { createLoopState, loadLoopState, readLoopEvents, loopStatePath } from "../../state/loop-state.js";

const CONFIG = { enabled: true, maxIterations: 10, maxNoProgress: 3 };

function tmpRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-driver-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function fakeClient(calls, order = null) {
  return {
    session: {
      prompt(payload) {
        if (order) order.push("prompt");
        calls.push(payload);
        return Promise.resolve();
      },
    },
  };
}

test("task loop is disabled by default", () => {
  assert.equal(DEFAULT_TASK_LOOP_CONFIG.enabled, false);
  const out = driveTaskLoop({ projectRoot: "/tmp/x", taskId: "t", sessionId: "s" });
  assert.equal(out.prompted, false);
  assert.equal(out.reason, "disabled");
});

test("non session.idle events are ignored", () => {
  const out = driveTaskLoop({
    event: { type: "message.updated", properties: { sessionID: "s1" } },
    projectRoot: "/tmp/x",
    taskId: "t",
    config: CONFIG,
  });
  assert.equal(out.prompted, false);
  assert.equal(out.reason, "not-session-idle");
});

test("CONTINUE persists before prompting", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-continue";
  const calls = [];
  const order = [];
  const base = createLoopState({ taskId: "task-1", sessionId: sid });

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    client: fakeClient(calls, order),
    config: CONFIG,
    deps: {
      loadTask: () => ({ state: "EXECUTING" }),
      evaluateGate: () => ({ pending: ["req-1"] }),
      loadLoop: () => ({ state: base, corrupt: false }),
      record: (_taskId, _root, nextState) => {
        order.push("record");
        return { state: nextState, appended: true };
      },
    },
  });

  assert.equal(out.prompted, true);
  assert.equal(out.decision, "CONTINUE");
  assert.deepEqual(order, ["record", "prompt"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sessionID, sid);
  assert.equal(calls[0].body.parts[0].synthetic, true);
});

test("agent outcome is handed to the decision", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-agent";
  const seen = [];
  const agent = { status: "COMPLETED", verdict: "ACCEPTED", results: [] };

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    config: CONFIG,
    agent,
    deps: {
      loadTask: () => ({ state: "EXECUTING" }),
      evaluateGate: () => ({ pending: ["req-1"] }),
      loadLoop: () => ({ state: createLoopState({ taskId: "task-1", sessionId: sid }), corrupt: false }),
      decide: (args) => {
        seen.push(args);
        return { decision: "WAIT_USER", reason: "captured" };
      },
      record: (_taskId, _root, nextState) => ({ state: nextState, appended: true }),
    },
  });

  assert.equal(seen.length, 1);
  assert.equal(seen[0].agent, agent);
  assert.equal(out.decision, "WAIT_USER");
  assert.equal(out.prompted, false);
});

test("WAIT_AUTHORIZATION records but does not prompt", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-auth";
  const calls = [];
  let records = 0;

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    client: fakeClient(calls),
    config: CONFIG,
    deps: {
      loadTask: () => ({ state: "EXECUTING", pendingAuthorization: { id: "auth-1", status: "pending" } }),
      evaluateGate: () => ({ pending: ["req-1"] }),
      loadLoop: () => ({ state: createLoopState({ taskId: "task-1", sessionId: sid }), corrupt: false }),
      record: (_taskId, _root, nextState) => {
        records += 1;
        return { state: nextState, appended: true };
      },
    },
  });

  assert.equal(out.prompted, false);
  assert.equal(out.decision, "WAIT_AUTHORIZATION");
  assert.equal(records, 1);
  assert.equal(calls.length, 0);
});

test("duplicate turn is ignored", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-duplicate";
  const calls = [];
  let records = 0;

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    turnId: "turn-1",
    client: fakeClient(calls),
    config: CONFIG,
    deps: {
      loadTask: () => ({ state: "EXECUTING" }),
      evaluateGate: () => ({ pending: ["req-1"] }),
      loadLoop: () => ({
        state: { ...createLoopState({ taskId: "task-1", sessionId: sid }), lastTurnId: "turn-1" },
        corrupt: false,
      }),
      record: (_taskId, _root, nextState) => {
        records += 1;
        return { state: nextState, appended: true };
      },
    },
  });

  assert.equal(out.prompted, false);
  assert.equal(out.reason, "duplicate-turn");
  assert.equal(records, 0);
  assert.equal(calls.length, 0);
});

test("a second call while a prompt is in flight is rejected", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-inflight";
  let resolvePrompt;
  const client = {
    session: {
      prompt() {
        return new Promise((resolve) => {
          resolvePrompt = resolve;
        });
      },
    },
  };
  const deps = {
    loadTask: () => ({ state: "EXECUTING" }),
    evaluateGate: () => ({ pending: ["req-1"] }),
    loadLoop: () => ({ state: createLoopState({ taskId: "task-1", sessionId: sid }), corrupt: false }),
    record: (_taskId, _root, nextState) => ({ state: nextState, appended: true }),
  };

  const first = driveTaskLoop({ projectRoot: root, taskId: "task-1", sessionId: sid, client, config: CONFIG, deps });
  assert.equal(first.prompted, true);

  const second = driveTaskLoop({ projectRoot: root, taskId: "task-1", sessionId: sid, client, config: CONFIG, deps });
  assert.equal(second.prompted, false);
  assert.equal(second.reason, "in-flight");

  resolvePrompt();
  await new Promise((resolve) => setImmediate(resolve));
});

test("decision errors fail soft", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-error";
  const calls = [];

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    client: fakeClient(calls),
    config: CONFIG,
    deps: {
      loadTask: () => ({ state: "EXECUTING" }),
      evaluateGate: () => ({ pending: [] }),
      loadLoop: () => ({ state: createLoopState({ taskId: "task-1", sessionId: sid }), corrupt: false }),
      decide: () => {
        throw new Error("boom");
      },
      record: () => {
        throw new Error("should not record");
      },
    },
  });

  assert.equal(out.prompted, false);
  assert.equal(out.reason, "error");
  assert.equal(out.error.message, "boom");
  assert.equal(calls.length, 0);
});

test("integration persists loop state through the real store", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-integration";
  const calls = [];

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-int",
    sessionId: sid,
    turnId: "turn-int",
    client: fakeClient(calls),
    config: CONFIG,
    deps: {
      loadTask: () => ({ state: "EXECUTING" }),
      evaluateGate: () => ({ pending: ["req-1"] }),
    },
  });

  assert.equal(out.prompted, true);
  assert.equal(out.decision, "CONTINUE");
  assert.ok(fs.existsSync(loopStatePath("task-int", root)));

  const loaded = loadLoopState("task-int", root);
  assert.equal(loaded.corrupt, false);
  assert.equal(loaded.state.sequence, 1);
  assert.equal(loaded.state.lastTurnId, "turn-int");
  assert.equal(loaded.state.iteration, 1);

  const events = readLoopEvents("task-int", root);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "decision");
});

test("buildLoopPrompt mirrors the task loop payload", () => {
  const payload = buildLoopPrompt({
    decision: "CONTINUE",
    reason: "work-remaining",
    nextAction: { type: "continue", reason: "work-remaining" },
  });
  assert.equal(payload.parts[0].synthetic, true);
  assert.match(payload.parts[0].text, /CONTINUE/);
  assert.equal(path.basename(loopStatePath("t", "/tmp/root")).length > 0, true);
});

test("quality contracts block completion when evidence is missing", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-quality-missing";
  const task = {
    id: "task-1",
    kind: "implementation",
    state: "VERIFYING",
    requirements: [{ id: "r1" }],
    evidence: [],
  };
  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    config: CONFIG,
    qualityConfig: { enabled: true },
    deps: {
      loadTask: () => task,
      evaluateGate: () => ({ ok: true, pending: [] }),
    },
  });
  assert.equal(out.decision, "VERIFY");
  assert.equal(out.reason, "quality-insufficient");
});

test("quality contracts allow completion when evidence is sufficient", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-quality-complete";
  const task = {
    id: "task-1",
    kind: "implementation",
    state: "VERIFYING",
    requirements: [{ id: "r1" }],
    evidence: [
      { criterionId: "r1", type: "TEST_RESULT", strength: "L4_VERIFICATION", status: "pass" },
      { criterionId: "r1", type: "DIRECT", strength: "L3_DIRECT", status: "pass" },
    ],
  };
  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: sid,
    config: CONFIG,
    qualityConfig: { enabled: true },
    deps: {
      loadTask: () => task,
      evaluateGate: () => ({ ok: true, pending: [] }),
    },
  });
  assert.equal(out.decision, "COMPLETE");
});
