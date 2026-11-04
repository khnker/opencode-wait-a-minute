import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { driveTaskLoop, buildLoopPrompt, DEFAULT_TASK_LOOP_CONFIG } from "./session-driver.js";
import { agentSignalForLoop, resetAuthorizationSurface } from "../../execution/agent-run-state.js";
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

test("WAIT_AUTHORIZATION prompts with the pending authorization", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-auth-once";
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

  assert.equal(out.prompted, true);
  assert.equal(out.decision, "WAIT_AUTHORIZATION");
  assert.equal(records, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.parts[0].text, /Authorization pending: auth-1/);
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

test("COMPLETE persists the task as DONE", (t) => {
  const root = tmpRoot(t);
  const persisted = [];
  const task = {
    id: "task-1",
    phase: "IMPLEMENTING",
    requirements: [{ id: "req-1", status: "verified", evidence: [{ evidence: "hola.txt" }] }],
  };

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-1",
    sessionId: "ses-complete",
    config: CONFIG,
    deps: {
      loadTask: () => task,
      evaluateGate: () => ({ blocked: false, allDone: true, completionIntent: false }),
      persistTask: (...args) => persisted.push(args),
    },
  });

  assert.equal(out.decision, "COMPLETE");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0][1].phase, "DONE");
  assert.equal(persisted[0][1].nextAction, "Tarea completa — contrato verificado");
});

test("exhausted WAIT_USER surfaces once and persists the marker", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-exhausted";
  const calls = [];
  let task = {
    state: "EXECUTING",
    requirements: [{ id: "req-1", status: "pending" }],
    agentRun: {
      status: "COMPLETED",
      verdict: "REVISION_REQUIRED",
      exhausted: true,
      cycles: { revisions: 1, replans: 0 },
      results: [{ role: "REVIEWER", findings: [{ id: "F-R1", summary: "sentinel query" }] }],
    },
  };
  let loop = createLoopState({ taskId: "task-1", sessionId: sid });

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-1",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      agent: agentSignalForLoop(null, task),
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ pending: ["req-1"] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
        persistTask: (_taskId, nextTask) => {
          task = nextTask;
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "WAIT_USER");
  assert.equal(first.prompted, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.parts[0].text, /F-R1/);
  assert.equal(task.agentRun.surfaced, true);

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});

test("non-agent WAIT_USER surfaces on the transition only", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-contract";
  const calls = [];
  const task = { state: "PROPOSED", contract: { status: "PROPOSED" } };
  let loop = createLoopState({ taskId: "task-2", sessionId: sid });

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-2",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ ok: false, pending: [] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "WAIT_USER");
  assert.equal(first.reason, "contract-not-approved");
  assert.equal(first.prompted, true);
  assert.equal(calls.length, 1);

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});

test("pending authorization surfaces once and persists the marker", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-auth-transition";
  const calls = [];
  let task = {
    state: "EXECUTING",
    requirements: [],
    pendingAuthorization: { id: "auth-1", status: "pending" },
  };
  let loop = createLoopState({ taskId: "task-auth", sessionId: sid });

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-auth",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ ok: false, pending: [] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
        persistTask: (_taskId, nextTask) => {
          task = nextTask;
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "WAIT_AUTHORIZATION");
  assert.equal(first.prompted, true);
  assert.match(calls[0].body.parts[0].text, /Authorization pending: auth-1/);
  assert.equal(task.authorizationSurfacedId, "auth-1");

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});

test("failed agent BLOCK surfaces once and persists the marker", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-failed";
  const calls = [];
  let task = {
    state: "EXECUTING",
    requirements: [],
    agentRun: { status: "FAILED", exhausted: false },
  };
  let loop = createLoopState({ taskId: "task-failed", sessionId: sid });

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-failed",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      agent: agentSignalForLoop(null, task),
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ ok: false, pending: [] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
        persistTask: (_taskId, nextTask) => {
          task = nextTask;
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "BLOCK");
  assert.equal(first.reason, "agent-failed");
  assert.equal(first.prompted, true);
  assert.match(calls[0].body.parts[0].text, /Blocked: agent-failed/);
  assert.equal(task.agentRun.surfaced, true);

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});

test("approved contract ignores a pending authorization", (t) => {
  const root = tmpRoot(t);
  const sid = "ses-auth-approved";

  const out = driveTaskLoop({
    projectRoot: root,
    taskId: "task-auth-approved",
    sessionId: sid,
    config: CONFIG,
    deps: {
      loadTask: () => ({
        state: "EXECUTING",
        contract: { status: "APPROVED" },
        pendingAuthorization: { id: "auth-1", status: "pending" },
        requirements: [],
      }),
      evaluateGate: () => ({ pending: ["req-1"] }),
      loadLoop: () => ({
        state: createLoopState({ taskId: "task-auth-approved", sessionId: sid }),
        corrupt: false,
      }),
      record: (_taskId, _root, nextState) => ({ state: nextState, appended: true }),
    },
  });

  assert.equal(out.decision, "CONTINUE");
  assert.equal(out.reason, "work-remaining");
});

test("pending authorization re-surfaces after the user turn resets the marker", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-auth-reset";
  const calls = [];
  const task = {
    state: "EXECUTING",
    contract: { status: "PROPOSED" },
    pendingAuthorization: { id: "auth-1", status: "pending" },
    requirements: [],
  };
  let loop = createLoopState({ taskId: "task-auth-reset", sessionId: sid });

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-auth-reset",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ pending: ["req-1"] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
        persistTask: (_taskId, nextTask) => {
          Object.assign(task, nextTask);
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "WAIT_AUTHORIZATION");
  assert.equal(first.prompted, true);
  assert.equal(task.authorizationSurfacedId, "auth-1");
  assert.equal(calls.length, 1);

  resetAuthorizationSurface(task);
  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, true);
  assert.equal(calls.length, 2);
});

test("stopped loop surfaces once and stays silent", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-stopped";
  const calls = [];
  const task = { state: "EXECUTING", requirements: [] };
  let loop = createLoopState({ taskId: "task-stopped", sessionId: sid });
  loop.status = "STOPPED";
  loop.stopReason = "stagnation";

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-stopped",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ pending: ["req-1"] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "STOP_STAGNATION");
  assert.equal(first.prompted, true);
  assert.match(calls[0].body.parts[0].text, /Stopped: stagnation/);

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});

test("budget stop surfaces once", async (t) => {
  const root = tmpRoot(t);
  const sid = "ses-budget";
  const calls = [];
  const task = { state: "EXECUTING", requirements: [] };
  let loop = createLoopState({ taskId: "task-budget", sessionId: sid });
  loop.iteration = 10;
  loop.maxIterations = 10;

  const run = () =>
    driveTaskLoop({
      projectRoot: root,
      taskId: "task-budget",
      sessionId: sid,
      client: fakeClient(calls),
      config: CONFIG,
      deps: {
        loadTask: () => task,
        evaluateGate: () => ({ pending: ["req-1"] }),
        loadLoop: () => ({ state: loop, corrupt: false }),
        record: (_taskId, _root, nextState) => {
          loop = nextState;
          return { state: nextState, appended: true };
        },
      },
    });

  const first = run();
  assert.equal(first.decision, "STOP_BUDGET");
  assert.equal(first.prompted, true);
  assert.match(calls[0].body.parts[0].text, /Stopped: budget-exhausted/);

  await new Promise((resolve) => setImmediate(resolve));
  const second = run();
  assert.equal(second.prompted, false);
  assert.equal(calls.length, 1);
});
