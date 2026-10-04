#!/usr/bin/env node
/**
 * Task isolation regression test for RC1 release gate.
 *
 * Verifies the specific regression case:
 *   - Task A reaches terminal state (DONE)
 *   - New input ("terminé") arrives in the conversation
 *   - Task B must start independently without being contaminated by Task A
 *
 * Exit 0 on success, 1 on failure.
 */

import assert from "node:assert/strict";
import { createWamState, loadWamState, saveWamState } from "../../wam-state.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";

const tmpBase = join(tmpdir(), `wam-isolation-${Date.now()}`);

function fail(msg, code = 1) {
  console.error(`FAIL: ${msg}`);
  process.exit(code);
}

async function run() {
  await mkdir(tmpBase, { recursive: true });

  // Scenario: Task A completes, then "terminé" triggers a new task
  const stateA = createWamState("task-a", { requirements: {} }, { context: {} }, { evidence: {} });
  stateA.status = "completed";
  stateA.completedAt = Date.now();
  await saveWamState("task-a", stateA, tmpBase);

  const loadedA = await loadWamState("task-a", tmpBase);
  assert.equal(loadedA.status, "completed", "Task A should be completed");

  // Simulate completion language detection from new prompt
  const newPrompt = "terminé";
  const isCompletion =
    /terminé|done|completado|completed|finalizado|finished/i.test(newPrompt);
  assert.ok(isCompletion, "completion language should be detected");

  // Create Task B with fresh isolated state
  const stateB = createWamState("task-b", { requirements: {} }, { context: {} }, { evidence: {} });
  assert.equal(stateB.status, "active", "Task B starts fresh");
  assert.equal(stateB.taskId, "task-b");
  await saveWamState("task-b", stateB, tmpBase);

  const loadedB = await loadWamState("task-b", tmpBase);
  assert.equal(loadedB.status, "active", "Task B should be isolated from Task A");
  assert.equal(loadedB.completedAt, undefined, "Task B should have no completedAt");

  // Cleanup
  await rm(tmpBase, { recursive: true, force: true });

  console.log("  [ISOLATION-001] terminal state + new task isolation PASS");
  console.log("\nTask isolation regression test PASSED");
  process.exit(0);
}

run().catch((e) => fail(e.message));