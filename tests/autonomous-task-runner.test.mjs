/**
 * tests/autonomous-task-runner.test.mjs
 *
 * Tests for scripts/autonomous-task-runner.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { collectTests } from "../scripts/run-tests.mjs";
import { saveState } from "../scripts/autonomous-task-runner.mjs";

const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, ".wam", "task-state.json");

function backupState() {
  const backupPath = STATE_PATH + ".backup";
  if (fs.existsSync(STATE_PATH)) {
    fs.copyFileSync(STATE_PATH, backupPath);
    return () => fs.renameSync(backupPath, STATE_PATH);
  }
  return () => {};
}

test("collectTests discovers *.test.mjs files recursively", () => {
  const tests = collectTests(ROOT);
  assert(Array.isArray(tests), "collectTests should return an array");
  assert(tests.length > 0, "Should discover at least one test file");
  // Verify all files end with .test.mjs
  for (const file of tests) {
    assert(file.endsWith(".test.mjs"), `File ${file} should end with .test.mjs`);
  }
});

test("autonomous-task-runner loads and parses task-state.json", () => {
  // Check that state loads without error
  assert.doesNotThrow(() => {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    assert(state.tasks, "State should have tasks property");
    assert(state.tasks["TASK-06"], "Should have TASK-06");
    assert(state.tasks["TASK-07"], "Should have TASK-07");
    assert(state.tasks["TASK-08"], "Should have TASK-08");
    assert(state.tasks["TASK-09"], "Should have TASK-09");
  });
});

test("autonomous-task-runner script exists", () => {
  const runnerPath = path.join(ROOT, "scripts",
    "autonomous-task-runner.mjs");
  assert(fs.existsSync(runnerPath), "autonomous-task-runner.mjs should exist");
});

test("package.json includes wam:next script", () => {
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert(pkg.scripts["wam:next"], "package.json should have wam:next script");
  assert(pkg.scripts["wam:next"].includes("autonomous-task-runner"),
    "wam:next should reference autonomous-task-runner.mjs");
});

test("autonomous-task-runner maintains JSON format when saving state", () => {
  const restore = backupState();
  try {
    // Get original state
    const originalState = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));

    // Create a temporary state file
    const tempStatePath = STATE_PATH + ".temp";
    fs.copyFileSync(STATE_PATH, tempStatePath);

    // Update the state
    const updatedState = {
      ...originalState,
      lastCheckpoint: "TASK-06"
    };

    // Save the state using the runner's function
    saveState(updatedState);

    // Verify state file is still valid JSON
    const finalState = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    assert(finalState.tasks, "State should still have tasks property");
    assert(finalState.lastCheckpoint === "TASK-06",
      "Last checkpoint should be TASK-06");

    // Try to parse again (will throw if invalid JSON)
    const reparsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    assert(reparsed.tasks, "State should be re-parsable as JSON");

  } finally {
    restore();
  }
});

test("autonomous-task-runner does not overwrite state on corrupted write", () => {
  const restore = backupState();
  try {
    // Get original state
    const originalState = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const originalString = fs.readFileSync(STATE_PATH, "utf8");

    // Create a backup of the state file
    const tempStatePath = STATE_PATH + ".temp";
    fs.copyFileSync(STATE_PATH, tempStatePath);
    const stateDir = path.dirname(STATE_PATH);
    try {
      // Make the .wam directory read-only to simulate write failure

      // Create a temporary state file to work with
      fs.copyFileSync(tempStatePath, STATE_PATH);

      // Make the .wam directory read-only to trigger write error
      fs.chmodSync(stateDir, 0o555); // read + execute

      // Try to run a task (should fail to save state)
      const result = spawnSync("node", [
        "scripts/autonomous-task-runner.mjs",
        "--task=TASK-06",
        "--timeout=5000"
      ], {
        encoding: "utf8",
        cwd: ROOT
      });

      // State should still be the original
      const currentState = fs.readFileSync(STATE_PATH, "utf8");
      assert.strictEqual(currentState, originalString,
        "State should not be overwritten on write failure");

    } finally {
      // Always restore a guaranteed-writable mode. Reusing a captured mode
      // would perpetuate 0o555 if a previous run already leaked it, and then
      // the outer restore() rename below would throw EACCES.
      fs.chmodSync(stateDir, 0o755);
      // Restore state from backup
      fs.copyFileSync(tempStatePath, STATE_PATH);
      fs.unlinkSync(tempStatePath);
    }

  } finally {
    // Guarantee .wam is writable before the outer restore() renames into it.
    fs.chmodSync(path.dirname(STATE_PATH), 0o755);
    restore();
  }
});
