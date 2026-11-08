import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { driveTaskLoop } from "../../src/adapters/opencode-v1/session-driver.js";

function stoppedSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "prior-run",
    taskId: "task-stale",
    sessionId: "ses_stale",
    status: "STOPPED",
    iteration: 2,
    maxIterations: 10,
    maxNoProgress: 3,
    startedAt: 1,
    updatedAt: 2,
    lastTurnId: null,
    lastProgressFingerprint: "EXECUTING:0/1:1",
    consecutiveNoProgress: 2,
    stopReason: "no-progress",
    sequence: 6,
    lastDecision: "STOP_STAGNATION",
    ...overrides,
  };
}

function run(previous) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-loop-"));
  let recorded = null;
  const result = driveTaskLoop({
    sessionId: "ses_stale",
    projectRoot: root,
    taskId: "task-stale",
    config: { enabled: true, maxIterations: 10, maxNoProgress: 3 },
    now: 5,
    deps: {
      loadTask: () => ({
        state: "IMPLEMENTING",
        phase: "IMPLEMENTING",
        contract: { status: "APPROVED" },
        requirements: [{ id: "req-1", status: "pending" }],
      }),
      loadLoop: () => ({ state: previous, corrupt: false }),
      evaluateGate: () => ({ pending: [] }),
      decide: () => ({ decision: "CONTINUE", reason: "progress-available" }),
      record: (_taskId, _root, state) => {
        recorded = state;
        return { state };
      },
      persistTask: () => {},
    },
  });
  fs.rmSync(root, { recursive: true, force: true });
  return { result, recorded };
}

test("a STOPPED prior snapshot is discarded instead of inherited", () => {
  const { recorded } = run(stoppedSnapshot());
  assert.ok(recorded, "loop state must be recorded");
  assert.notEqual(recorded.runId, "prior-run", "new attempt must start a fresh run");
  assert.notEqual(recorded.lastDecision, "STOP_STAGNATION");
  assert.ok(recorded.iteration <= 1, "iteration must restart, not resume at 2");
});

test("a snapshot from another task/session is discarded", () => {
  const { recorded } = run(stoppedSnapshot({ status: "RUNNING", taskId: "other-task", iteration: 4 }));
  assert.ok(recorded, "loop state must be recorded");
  assert.notEqual(recorded.taskId, "other-task");
});
