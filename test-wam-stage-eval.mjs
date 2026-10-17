/**
 * test-wam-stage-eval.mjs
 *
 * Programmatic lifecycle test for WAM task-lifecycle.
 * Creates task 'test-wam-stage-eval', walks it through
 *   PROPOSED -> APPROVED -> IMPLEMENTING -> VERIFYING -> DONE
 * and verifies that .wam/tasks/test-wam-stage-eval/task.json
 * exists and reflects the correct phase at each stage.
 *
 * Usage: node test-wam-stage-eval.mjs
 */

import { create, switchTo, resume } from "./src/state/task-lifecycle.js";
import { loadTask } from "./src/state/task-store.js";
import fs from "node:fs";
import path from "node:path";

const TASK_ID = "test-wam-stage-eval";
const ROOT = process.cwd();
const TASK_DIR = path.join(ROOT, ".wam", "tasks", TASK_ID);
const STATE_FILE = path.join(TASK_DIR, "task.json");

const EXPECTED_PHASES = ["PROPOSED", "APPROVED", "IMPLEMENTING", "VERIFYING", "DONE"];

let failures = 0;
let passed = 0;

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failures++;
    console.log(`  FAIL: ${label}${detail ? " — " + detail : ""}`);
  }
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

// ── Cleanup any prior run ──
if (fs.existsSync(TASK_DIR)) {
  fs.rmSync(TASK_DIR, { recursive: true, force: true });
}

console.log("=== WAM Task Lifecycle — Stage Evaluation ===\n");

// ── Stage 1: Create (PROPOSED) ──
console.log("[1] Create task via task-lifecycle.create()…");
let state;
try {
  state = create(TASK_ID, ROOT);
  check("create() returns state", !!state && !!state.taskId);
  check("state.phase === PROPOSED", state.phase === "PROPOSED", `got ${state.phase}`);
  check("state file exists", fs.existsSync(STATE_FILE));
  const onDisk = readState();
  check("on-disk state matches", !!onDisk && onDisk.phase === "PROPOSED");
  check("on-disk taskId", onDisk && onDisk.taskId === TASK_ID);
} catch (err) {
  check("create() threw", false, err.message);
}

// ── Stage 2: APPROVED ──
console.log("\n[2] Transition PROPOSED -> APPROVED via switchTo()…");
try {
  switchTo(TASK_ID, "APPROVED", ROOT);
  const s = loadTask(TASK_ID, ROOT);
  check("phase === APPROVED", s && s.phase === "APPROVED", `got ${s && s.phase}`);
  check("state file exists", fs.existsSync(STATE_FILE));
  const onDisk = readState();
  check("on-disk phase APPROVED", onDisk && onDisk.phase === "APPROVED");
} catch (err) {
  check("switchTo APPROVED threw", false, err.message);
}

// ── Stage 3: IMPLEMENTING ──
console.log("\n[3] Transition APPROVED -> IMPLEMENTING via switchTo()…");
try {
  switchTo(TASK_ID, "IMPLEMENTING", ROOT);
  const s = loadTask(TASK_ID, ROOT);
  check("phase === IMPLEMENTING", s && s.phase === "IMPLEMENTING", `got ${s && s.phase}`);
  const onDisk = readState();
  check("on-disk phase IMPLEMENTING", onDisk && onDisk.phase === "IMPLEMENTING");
} catch (err) {
  check("switchTo IMPLEMENTING threw", false, err.message);
}

// ── Stage 4: VERIFYING ──
console.log("\n[4] Transition IMPLEMENTING -> VERIFYING via switchTo()…");
try {
  switchTo(TASK_ID, "VERIFYING", ROOT);
  const s = loadTask(TASK_ID, ROOT);
  check("phase === VERIFYING", s && s.phase === "VERIFYING", `got ${s && s.phase}`);
  const onDisk = readState();
  check("on-disk phase VERIFYING", onDisk && onDisk.phase === "VERIFYING");
} catch (err) {
  check("switchTo VERIFYING threw", false, err.message);
}

// ── Stage 5: DONE (terminal) ──
console.log("\n[5] Transition VERIFYING -> DONE via switchTo()…");
try {
  switchTo(TASK_ID, "DONE", ROOT);
  const s = loadTask(TASK_ID, ROOT);
  check("phase === DONE", s && s.phase === "DONE", `got ${s && s.phase}`);
  const onDisk = readState();
  check("on-disk phase DONE", onDisk && onDisk.phase === "DONE");
} catch (err) {
  check("switchTo DONE threw", false, err.message);
}

// ── Stage 6: Terminal-phase guard ──
console.log("\n[6] Verify terminal-phase guard (DONE is terminal)…");
try {
  switchTo(TASK_ID, "PROPOSED", ROOT);
  check("transition from DONE blocked", false, "should have thrown");
} catch (err) {
  check("transition from DONE blocked", /terminal/.test(err.message), err.message);
}

// ── Stage 7: resume() after DONE ──
console.log("\n[7] Verify resume() on DONE task…");
try {
  const r = resume(TASK_ID, ROOT);
  check("resume() returns state", !!r);
  check("resume preserves DONE phase", r && r.phase === "DONE", `got ${r && r.phase}`);
} catch (err) {
  check("resume() threw", false, err.message);
}

// ── Stage 8: Full lifecycle trace from disk ──
console.log("\n[8] Full lifecycle trace…");
const final = readState();
check("final state file exists", !!final);
if (final) {
  check("final taskId", final.taskId === TASK_ID);
  check("final phase DONE", final.phase === "DONE");
  check("updatedAt is a number", typeof final.updatedAt === "number");
}

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failures} failed ===`);
if (failures > 0) {
  console.error("VERIFICATION FAILED");
  process.exit(1);
} else {
  console.log("VERIFICATION PASSED — all stage transitions correct");
}