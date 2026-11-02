import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  LOOP_SCHEMA_VERSION,
  createLoopState,
  validateLoopState,
  loadLoopState,
  saveLoopState,
  readLoopEvents,
  appendLoopEvent,
  recoverLoopState,
  applyLoopDecision,
  recordLoopDecision,
  withLoopLock,
  loopExecutionDir,
  loopStatePath,
  loopEventsPath,
  loopLockPath,
} from "./loop-state.js";

function tmpRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-loop-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function baseState(overrides = {}) {
  return createLoopState({ taskId: "task-1", sessionId: "ses-1", runId: "run-1", now: 1000, ...overrides });
}

test("createLoopState defaults and validation", () => {
  const state = baseState();
  assert.equal(state.schemaVersion, LOOP_SCHEMA_VERSION);
  assert.equal(state.status, "RUNNING");
  assert.equal(state.iteration, 0);
  assert.equal(state.sequence, 0);
  assert.equal(state.maxIterations, 10);
  assert.equal(state.maxNoProgress, 3);
  assert.equal(validateLoopState(state), state);

  assert.throws(() => validateLoopState({ ...state, schemaVersion: 99 }), /schemaVersion/);
  assert.throws(() => validateLoopState({ ...state, runId: "" }), /runId/);
  assert.throws(() => validateLoopState({ ...state, taskId: "" }), /taskId/);
  assert.throws(() => validateLoopState({ ...state, status: "BOGUS" }), /invalid status/);
  assert.throws(() => validateLoopState({ ...state, iteration: Number.NaN }), /iteration/);
  assert.throws(() => validateLoopState({ ...state, startedAt: Infinity }), /startedAt/);
  assert.throws(() => validateLoopState({ ...state, updatedAt: undefined }), /updatedAt/);
});

test("save/load round-trip at the expected path", (t) => {
  const root = tmpRoot(t);
  const state = baseState();
  saveLoopState("task-1", root, state);
  assert.equal(loopStatePath("task-1", root), path.join(loopExecutionDir("task-1", root), "loop-state.json"));
  assert.ok(fs.existsSync(loopStatePath("task-1", root)));
  assert.deepEqual(loadLoopState("task-1", root), { state, corrupt: false });

  saveLoopState("task-1", root, state);
  assert.deepEqual(loadLoopState("task-1", root).state, state);
  const leftovers = fs.readdirSync(loopExecutionDir("task-1", root)).filter((f) => f.includes(".tmp-"));
  assert.deepEqual(leftovers, []);
});

test("appendLoopEvent deduplicates by eventId and assigns sequence", (t) => {
  const root = tmpRoot(t);
  const first = appendLoopEvent("task-1", root, { eventId: "e1", type: "decision" });
  assert.equal(first.added, true);
  assert.equal(first.event.seq, 1);

  const duplicate = appendLoopEvent("task-1", root, { eventId: "e1", type: "decision" });
  assert.deepEqual(duplicate, { added: false, event: null });
  assert.equal(readLoopEvents("task-1", root).length, 1);

  const second = appendLoopEvent("task-1", root, { eventId: "e2", type: "decision" });
  assert.equal(second.event.seq, 2);
  assert.ok(fs.existsSync(loopEventsPath("task-1", root)));
});

test("recoverLoopState replays events newer than the snapshot", (t) => {
  const root = tmpRoot(t);
  const base = baseState();
  saveLoopState("task-1", root, base);

  appendLoopEvent("task-1", root, {
    eventId: "e1",
    type: "decision",
    state: { ...base, sequence: 1, iteration: 1 },
  });
  appendLoopEvent("task-1", root, {
    eventId: "e2",
    type: "decision",
    state: { ...base, sequence: 2, iteration: 2 },
  });

  const recovered = recoverLoopState("task-1", root);
  assert.equal(recovered.corrupt, false);
  assert.equal(recovered.replayed, 2);
  assert.equal(recovered.state.iteration, 2);
  assert.equal(recovered.state.sequence, 2);
});

test("corrupt snapshot is reported and rebuilt without being overwritten", (t) => {
  const root = tmpRoot(t);
  fs.mkdirSync(loopExecutionDir("task-1", root), { recursive: true });
  const file = loopStatePath("task-1", root);
  fs.writeFileSync(file, "{ not json");

  assert.deepEqual(loadLoopState("task-1", root), { state: null, corrupt: true });

  const base = baseState();
  appendLoopEvent("task-1", root, {
    eventId: "e1",
    type: "decision",
    state: { ...base, sequence: 1, iteration: 1 },
  });

  const recovered = recoverLoopState("task-1", root);
  assert.equal(recovered.corrupt, true);
  assert.equal(recovered.replayed, 1);
  assert.equal(recovered.state.iteration, 1);
  assert.equal(fs.readFileSync(file, "utf8"), "{ not json");
});

test("saveLoopState quarantines a corrupt snapshot", (t) => {
  const root = tmpRoot(t);
  fs.mkdirSync(loopExecutionDir("task-1", root), { recursive: true });
  fs.writeFileSync(loopStatePath("task-1", root), "{ not json");

  const state = baseState();
  saveLoopState("task-1", root, state);
  assert.deepEqual(loadLoopState("task-1", root), { state, corrupt: false });

  const quarantined = fs.readdirSync(loopExecutionDir("task-1", root)).filter((f) => f.startsWith("loop-state.corrupt-"));
  assert.equal(quarantined.length, 1);
});

test("withLoopLock rejects nested acquisition and releases afterwards", (t) => {
  const root = tmpRoot(t);
  withLoopLock("task-1", root, () => {
    assert.ok(fs.existsSync(loopLockPath("task-1", root)));
    assert.throws(() => withLoopLock("task-1", root, () => {}), /loop-state: lock held/);
  });
  assert.equal(fs.existsSync(loopLockPath("task-1", root)), false);

  let ran = false;
  withLoopLock("task-1", root, () => {
    ran = true;
  });
  assert.equal(ran, true);
});

test("recordLoopDecision advances sequence, persists, and appends an event", (t) => {
  const root = tmpRoot(t);
  const state = baseState();
  saveLoopState("task-1", root, state);
  const result = {
    decision: "CONTINUE",
    checkpoint: { status: "RUNNING", iteration: 1, consecutiveNoProgress: 1, lastProgressFingerprint: "EXECUTING:0/0:1" },
    stopReason: null,
  };

  const next = applyLoopDecision(state, result, { turnId: "turn-1", now: 2000 });
  const out = recordLoopDecision("task-1", root, next, result, { eventId: "e1", turnId: "turn-1", now: 2000 });
  assert.equal(out.appended, true);
  assert.equal(out.state.sequence, 1);
  assert.equal(out.state.lastTurnId, "turn-1");
  assert.equal(out.state.iteration, 1);

  const loaded = loadLoopState("task-1", root);
  assert.equal(loaded.corrupt, false);
  assert.equal(loaded.state.sequence, 1);
  assert.equal(loaded.state.lastTurnId, "turn-1");

  const events = readLoopEvents("task-1", root);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "decision");
  assert.equal(events[0].decision, "CONTINUE");
  assert.equal(events[0].seq, 1);
});

test("paths reject task ids that could escape the task directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-loop-"));
  try {
    for (const bad of ["../escape", "a/b", "..", ".", "a\\b"]) {
      assert.throws(() => loopStatePath(bad, root), /invalid taskId/);
    }
    assert.ok(loopStatePath("task-1", root).includes(path.join("tasks", "task-1", "execution")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("recordLoopDecision persists the quality evaluation when present", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-loop-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = createLoopState({ taskId: "task-q", sessionId: "s" });
  const quality = { enabled: true, sufficient: false, reasons: ["missing:r1"] };
  recordLoopDecision("task-q", root, state, { decision: "VERIFY" }, { quality });
  const events = readLoopEvents("task-q", root);
  assert.deepEqual(events[0].quality, quality);
});
