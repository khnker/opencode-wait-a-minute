#!/usr/bin/env node
/**
 * scripts/autonomous-task-runner.mjs — robust task execution with persistent state.
 *
 * Reads .wam/task-state.json, marks tasks as running, executes corresponding
 * test suites, and updates state on success/failure. Supports single task or
 * --all mode with explicit timeouts and failure isolation.
 *
 * Robustness guarantees:
 *   - Status is always normalized via src/state/task-status.js (no case drift).
 *   - The persisted file is normalized on both load and save (no schema drift).
 *   - Completion is decided by explicit counts, never by an ambiguous null.
 *   - Invariants are asserted before acting: the runner fails loudly instead of
 *     reporting "all tasks completed" when pending tasks actually remain.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  TASK_STATUS,
  normalizeStatus,
  countByStatus,
  getNextPendingTask as findNextPendingTask,
} from "../src/state/task-status.js";
import { normalizeStateFile, validateStateFile } from "../src/state/task-state-file.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = process.cwd();
const STATE_PATH = path.join(ROOT, ".wam", "task-state.json");
const DEFAULT_TIMEOUT_MS = 120_000; // 120 seconds

// Registry fallback for tasks that do not declare their own testSuite.
// Paths are relative to ROOT and mirror the real test layout.
const TASK_TEST_REGISTRY = Object.freeze({
  "TASK-06": ["tests/unit/assembly-runtime-state.test.mjs"],
  "TASK-07": ["tests/unit/context-benchmark-router.test.mjs"],
  "TASK-08": ["tests/unit/context-optimization.test.mjs"],
  "TASK-09": ["tests/unit/context-optimization.test.mjs"],
});

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

// Module functions (exported for testing)
function loadState() {
  let raw;
  try {
    raw = fs.readFileSync(STATE_PATH, "utf8");
  } catch (e) {
    fail(`Failed to load task state: ${e.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`Task state is not valid JSON: ${e.message}`);
  }

  let state;
  try {
    state = normalizeStateFile(parsed);
  } catch (e) {
    fail(`Invalid task state: ${e.message}`);
  }

  const check = validateStateFile(state);
  if (!check.valid) {
    fail(`Invalid task state: ${check.error}`);
  }

  return state;
}

function saveState(state) {
  let normalized;
  try {
    normalized = normalizeStateFile(state);
  } catch (e) {
    fail(`Refusing to save invalid task state: ${e.message}`);
  }

  const check = validateStateFile(normalized);
  if (!check.valid) {
    fail(`Refusing to save invalid task state: ${check.error}`);
  }

  try {
    // Ensure atomic write
    const tmpPath = STATE_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), "utf8");
    fs.renameSync(tmpPath, STATE_PATH);
  } catch (e) {
    fail(`Failed to save task state: ${e.message}`);
  }
}

function getTaskMapping(taskId, state = null) {
  const declared = state?.tasks?.[taskId]?.testSuite;
  const relative = Array.isArray(declared) && declared.length > 0
    ? declared
    : TASK_TEST_REGISTRY[taskId] || [];
  return relative.map((p) => path.resolve(ROOT, p));
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function runTestSuite(testFiles, timeoutMs) {
  if (testFiles.length === 0) return { code: 0, stdout: "", stderr: "", durationMs: 0 };

  // Use node --test with concurrency=1 for deterministic execution
  const args = ["--test", "--test-concurrency=1", ...testFiles];
  const start = Date.now();

  const result = spawnSync("node", args, {
    timeout: timeoutMs,
    stdio: "pipe",
    encoding: "utf8",
    cwd: ROOT,
  });

  const durationMs = Date.now() - start;

  if (result.signal === "SIGTERM") {
    return {
      code: result.status || 1,
      signal: result.signal,
      stdout: result.stdout || "",
      stderr: result.stderr || `Timeout after ${formatDuration(timeoutMs)}`,
      durationMs,
    };
  }

  return {
    code: result.status || 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    durationMs,
  };
}

function updateTaskState(state, taskId, status, result = null, error = null) {
  const task = state.tasks[taskId];
  if (!task) return state;

  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) {
    fail(`Refusing to set task ${taskId} to invalid status "${status}"`);
  }
  task.status = normalizedStatus;

  if (normalizedStatus === TASK_STATUS.RUNNING && !task.startedAt) {
    task.startedAt = new Date().toISOString();
  }

  if (
    normalizedStatus === TASK_STATUS.COMPLETED ||
    normalizedStatus === TASK_STATUS.FAILED
  ) {
    task.completedAt = new Date().toISOString();
    if (!Array.isArray(task.validations)) task.validations = [];
    task.validations.push({
      timestamp: task.completedAt,
      result,
      error: error || null,
    });
  }

  // Update lastCheckpoint only on successful completion
  if (normalizedStatus === TASK_STATUS.COMPLETED) {
    state.lastCheckpoint = taskId;
  }

  return state;
}

function printSummary(state) {
  const counts = countByStatus(state.tasks);

  console.log("\n" + "=".repeat(60));
  console.log("🏁 EXECUTION SUMMARY");
  console.log("=".repeat(60));
  console.log("\nStatus:");
  console.log(`  ✅ Completed: ${counts.completed}`);
  if (counts.running > 0) console.log(`  🔄 Running: ${counts.running}`);
  if (counts.failed > 0) console.log(`  ❌ Failed: ${counts.failed}`);
  console.log(`  ⏳ Pending: ${counts.pending}`);

  if (counts.total > 0 && counts.pending === 0) {
    console.log("\n🎉 All tasks completed successfully!");
  } else {
    console.log("\n⚠️  Some tasks did not complete successfully.");
    const firstPending = findNextPendingTask(state.tasks);
    if (firstPending) {
      console.log(`   First pending task: ${firstPending}`);
    }
  }

  if (state.lastCheckpoint) {
    console.log(`\n📍 Last checkpoint: ${state.lastCheckpoint}`);
  }
}

function assertInvariants(state) {
  const counts = countByStatus(state.tasks);
  const nextPending = findNextPendingTask(state.tasks);

  if (counts.pending > 0 && nextPending === null) {
    fail(
      `Invariant violation: ${counts.pending} task(s) have status "pending" ` +
        `but no pending task could be selected. Refusing to report completion.`
    );
  }
}

function main() {
  const args = process.argv.slice(2);
  const taskArg = args.find((arg) => arg.startsWith("--task="));
  const taskId = taskArg ? taskArg.split("=")[1] : null;
  const allMode = args.includes("--all");

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout="));
  if (timeoutArg) {
    const parsed = parseInt(timeoutArg.split("=")[1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      timeoutMs = parsed;
    }
  }

  const state = loadState();
  assertInvariants(state);

  if (!allMode && !taskId) {
    fail("Specify either --task <TASK-ID> or --all");
  }

  const counts = countByStatus(state.tasks);
  if (counts.total === 0) {
    console.log("ℹ️  Task state contains no tasks. Nothing to do.");
    process.exit(0);
  }

  const targetTaskId = allMode ? findNextPendingTask(state.tasks) : taskId;

  if (!targetTaskId) {
    if (allMode) {
      const message =
        counts.pending === 0
          ? "No pending tasks."
          : "No pending task could be selected (invariant violation).";
      console.log(`ℹ️  ${message}`);
      printSummary(state);
      process.exit(counts.pending === 0 ? 0 : 1);
    }
    fail(`Task ${taskId} not found or already completed/failed.`);
  }

  const targetTask = state.tasks[targetTaskId];
  if (!targetTask) {
    fail(`Task ${targetTaskId} not found in state.`);
  }
  if (normalizeStatus(targetTask.status) === TASK_STATUS.RUNNING) {
    fail(`Task ${targetTaskId} is already running.`);
  }

  const testFiles = getTaskMapping(targetTaskId, state);
  if (testFiles.length === 0) {
    fail(`No test files mapped for ${targetTaskId}.`);
  }
  const missing = testFiles.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    fail(
      `Mapped test file(s) for ${targetTaskId} do not exist: ` +
        missing.map((f) => path.relative(ROOT, f)).join(", ")
    );
  }

  // Mark task as running
  updateTaskState(state, targetTaskId, TASK_STATUS.RUNNING);
  saveState(state);

  console.log(`🚀 Starting ${targetTaskId} (${testFiles.length} file(s))`);
  console.log(`⏱️  Timeout: ${formatDuration(timeoutMs)}\n`);

  const result = runTestSuite(testFiles, timeoutMs);

  if (result.code === 0 && !result.signal) {
    console.log(`\n✅ ${targetTaskId} completed successfully.`);
    updateTaskState(state, targetTaskId, TASK_STATUS.COMPLETED, result);
    saveState(state);
    printExecutionResult(targetTaskId, result);

    // Only continue with --all if there are more pending tasks
    if (allMode && findNextPendingTask(state.tasks)) {
      setImmediate(() => {
        console.log("\n🔄 Checking for next pending task...");
        main();
      });
      return;
    }
  } else {
    const errorMsg = result.signal ? `Signal ${result.signal}` : `Exit code ${result.code}`;
    console.error(`\n❌ ${targetTaskId} failed (${errorMsg}).`);
    updateTaskState(state, targetTaskId, TASK_STATUS.FAILED, result, errorMsg);
    saveState(state);
    printExecutionResult(targetTaskId, result);

    if (allMode) {
      console.log("\n🛑 Stopping execution due to failure.");
      console.log("   Use --task <TASK-ID> to retry this specific task individually.");
      printSummary(state);
      process.exit(1);
    }
  }

  // Print summary and exit
  printSummary(state);
  process.exit(result.code === 0 ? 0 : 1);
}

function printExecutionResult(taskId, result, error = null) {
  const files = getTaskMapping(taskId);
  const fileNames = files.map((f) => path.relative(ROOT, f)).join(", ");

  console.log(`\n📋 ${taskId}: ${fileNames}`);
  console.log(`⏱️  Duration: ${formatDuration(result.durationMs)}`);

  if (result.stdout) {
    console.log("\n--- stdout ---");
    console.log(result.stdout);
  }
  if (result.stderr) {
    console.log("\n--- stderr ---");
    console.log(result.stderr);
  }
  if (error) {
    console.log(`\n❌ Error: ${error}`);
  }
  if (result.signal) {
    console.log(`\n⚠️  Signal: ${result.signal}`);
  }

  const statusChar = result.code === 0 ? "✅" : "❌";
  console.log(`${statusChar} Exit code: ${result.code}`);
}

// Export module functions for tests
export {
  loadState,
  saveState,
  getTaskMapping,
  runTestSuite,
  updateTaskState,
  printExecutionResult,
  printSummary,
  assertInvariants,
  findNextPendingTask,
};

// Only run main when executed directly
if (process.argv[1] === __filename) {
  main();
}
