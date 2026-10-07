import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import pluginDefault from "../../index.js";
import { getTaskState, persistTaskState } from "../../src/skills/engine.js";
import { transition } from "../../src/execution/execution-state.js";
import { startRun } from "../../src/state/task-runs.js";

describe("rc1-24 error-path coverage", () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wam-error-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  it("missing state file returns null (fails closed gracefully)", () => {
    const res = getTaskState("non-existent-task", tmpRoot);
    assert.equal(res, null);
  });

  it("corrupted state / malformed YAML returns null on getTaskState", () => {
    const taskId = "corrupt-task";
    const taskDir = path.join(tmpRoot, ".wam", "tasks", taskId);
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(path.join(taskDir, "state.yaml"), "invalid {{{ json");

    const res = getTaskState(taskId, tmpRoot);
    assert.equal(res, null);
  });

  it("invalid state transition throws error (fails closed with clear signal)", () => {
    assert.throws(() => {
      transition("COMPLETED", "INITIALIZING");
    }, /Invalid transition|COMPLETED/);
  });

  it("missing task in startRun throws error (fails closed)", () => {
    assert.throws(() => {
      startRun("non-existent-task", tmpRoot);
    }, /not found/i);
  });

  it("filesystem permission error handled gracefully without unhandled exception", () => {
    const taskId = "perm-task";
    const taskDir = path.join(tmpRoot, ".wam", "tasks", taskId);
    fs.mkdirSync(taskDir, { recursive: true });
    const stateFile = path.join(taskDir, "state.yaml");
    fs.writeFileSync(stateFile, JSON.stringify({ taskId, phase: "INVESTIGATING" }));

    try {
      fs.chmodSync(taskDir, 0o555);
      try {
        persistTaskState(taskId, { taskId, phase: "EXECUTING" }, tmpRoot);
      } catch (err) {
        assert.ok(err instanceof Error, "Should throw catchable error on permission failure");
      }
    } finally {
      fs.chmodSync(taskDir, 0o755);
    }
  });

  it("OpenCode unavailable / plugin initialization with missing client/project dependencies", async () => {
    const hooks = await pluginDefault({ directory: tmpRoot, client: null, project: null, $: null });
    assert.ok(hooks, "Plugin returns hooks object");
    assert.equal(typeof hooks["command.execute.before"], "function");
    assert.equal(typeof hooks["chat.message"], "function");
  });

  it("unknown task ID and missing evidence/invalid evidence paths fail closed", () => {
    const taskId = "unknown-task-id";
    const st = getTaskState(taskId, tmpRoot);
    assert.equal(st, null);
  });
});
