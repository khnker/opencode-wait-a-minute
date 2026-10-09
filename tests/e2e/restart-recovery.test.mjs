#!/usr/bin/env node
/**
 * tests/e2e/restart-recovery.test.mjs
 *
 * Simulates REAL process restarts via node:child_process spawn.
 *
 * Child #1: creates+persists WAM state, prints a success sentinel, then exits.
 * Child #2: a FRESH process loads the state from the same rootDir and asserts
 * reconstruction of taskId/status/requirements/context/evidence
 * (resumeSession => resumable=true).
 *
 * Cases:
 *   1. new session      (state present, resumeSession => resumable=true)
 *   2. absent state     (file missing, loadWamState returns null)
 *   3. corrupted JSON   (bad JSON, load degrades — null or caught error, no crash)
 *   4. schema mismatch  (future _schemaVersion, resumeSession still reports it)
 *
 * No in-process shortcuts — every case runs in separate child processes.
 *
 * Discoverable by scripts/run-tests.mjs (filename matches *.test.mjs).
 * Uses node:test + node:assert/strict. Cleans up temp dirs.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, writeFile, rm } from "node:fs/promises";

const HERE = fileURLToPath(import.meta.url); // .../tests/e2e/restart-recovery.test.mjs
const HERE_DIR = join(HERE, ".."); // .../tests/e2e/
const REPO_ROOT = join(HERE_DIR, "..", ".."); // .../
const SRC = pathToFileURL(join(REPO_ROOT, "src", "state", "wam-state.js")).href;

// Child script. Spawned as:
//   node --input-type=module -e <SCRIPT> <srcUrl> <rootDir> <mode> <taskId>
// With `node -e <script> <args...>`, child process.argv is
// [execPath, ...args] — no script path element. Hence:
//   argv[1] = srcUrl, argv[2] = rootDir, argv[3] = mode, argv[4] = taskId
const SCRIPT = `
const [_, srcUrl, rootDir, mode, taskId] = process.argv;
const { createWamState, loadWamState, saveWamState, resumeSession } = await import(srcUrl);

if (mode === 'create') {
  const st = createWamState(taskId, { req: 'test' }, { ctx: 'test' }, { ev: 'test' });
  st.status = 'active';
  await saveWamState(taskId, st, rootDir);
  console.log('SENTINEL_CREATE_OK');
} else if (mode === 'load') {
  let st;
  try {
    st = await loadWamState(taskId, rootDir);
  } catch (err) {
    // Safe degradation: loading failed, but the fresh process reports it
    // instead of crashing or corrupting anything.
    console.log('SENTINEL_LOAD_THROW ' + err.constructor.name);
  }
  if (st === null || st === undefined) {
    console.log('SENTINEL_LOAD_NULL');
  } else {
    const r = resumeSession(st);
    console.log('SENTINEL_RESUME resumable=' + r.resumable);
    console.log('SENTINEL_STATUS ' + (st.status ?? 'MISSING'));
    console.log('SENTINEL_TASKID ' + (st.taskId ?? 'MISSING'));
    console.log('SENTINEL_REQ ' + JSON.stringify(st.requirements ?? {}));
    console.log('SENTINEL_CTX ' + JSON.stringify(st.context ?? {}));
    console.log('SENTINEL_EVD ' + JSON.stringify(st.evidence ?? {}));
    console.log('SENTINEL_SCHEMA ' + (st._schemaVersion ?? 'MISSING'));
  }
} else {
  console.error('unknown mode');
  process.exitCode = 1;
}
`;

function spawnChild(rootDir, mode, taskId) {
  return new Promise((resolve, reject) => {
    const cp = spawn(
      process.execPath,
      ["--input-type=module", "-e", SCRIPT, SRC, rootDir, mode, taskId],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    cp.stdout.setEncoding("utf8");
    cp.stderr.setEncoding("utf8");
    cp.stdout.on("data", (c) => { out += c; });
    cp.stderr.on("data", (c) => { err += c; });
    cp.on("error", reject);
    cp.on("close", (code) => resolve({ code, out, err }));
  });
}

const tmpBase = join(tmpdir(), `wam-restart-${process.pid}-${Date.now()}`);

after(async () => {
  await rm(tmpBase, { recursive: true, force: true });
});

await mkdir(tmpBase, { recursive: true });

test("restart recovers taskId, status, requirements, context, evidence", async () => {
  const root = join(tmpBase, "restart");
  await mkdir(root, { recursive: true });
  const taskId = "task-restart-ok";

  // Child #1 (real process): creates and persists, then exits.
  const c1 = await spawnChild(root, "create", taskId);
  assert.equal(c1.code, 0, `child create exited 0 (stderr: ${c1.err})`);
  assert.ok(c1.out.includes("SENTINEL_CREATE_OK"), "create sentinel present");

  // Child #2 (fresh real process): loads and asserts reconstruction.
  const c2 = await spawnChild(root, "load", taskId);
  assert.equal(c2.code, 0, `child load exited 0 (stderr: ${c2.err})`);
  assert.ok(c2.out.includes("SENTINEL_RESUME resumable=true"), "resumable after restart");
  assert.ok(c2.out.includes("SENTINEL_STATUS active"), "status reconstructed");
  assert.ok(c2.out.includes(`SENTINEL_TASKID ${taskId}`), "taskId reconstructed");
  assert.ok(c2.out.includes('"req":"test"'), "requirements reconstructed");
  assert.ok(c2.out.includes('"ctx":"test"'), "context reconstructed");
  assert.ok(c2.out.includes('"ev":"test"'), "evidence reconstructed");
});

test("restart with absent state returns null in a fresh process", async () => {
  const root = join(tmpBase, "absent");
  await mkdir(root, { recursive: true });

  const c = await spawnChild(root, "load", "task-absent");
  assert.equal(c.code, 0, "child exits 0 even for absent state");
  assert.ok(c.out.includes("SENTINEL_LOAD_NULL"), "loadWamState returns null for absent file");
});

test("restart with corrupted JSON does not crash the fresh process", async () => {
  const root = join(tmpBase, "corrupt");
  await mkdir(root, { recursive: true });
  const taskId = "task-corrupt";

  const badDir = join(root, taskId);
  await mkdir(badDir, { recursive: true });
  await writeFile(join(badDir, "wam-state.json"), "{not json", "utf8");

  const c = await spawnChild(root, "load", taskId);
  assert.equal(c.code, 0, "child exits 0 despite corrupted JSON");
  // Safe degradation contract: null OR a caught, reported error — never a crash.
  const degraded =
    c.out.includes("SENTINEL_LOAD_NULL") || c.out.includes("SENTINEL_LOAD_THROW");
  assert.ok(degraded, "load degrades safely (null or caught error)");
});

test("restart with schema mismatch loads and reports future schema version", async () => {
  const root = join(tmpBase, "schema");
  await mkdir(root, { recursive: true });
  const taskId = "task-schema";

  const badDir = join(root, taskId);
  await mkdir(badDir, { recursive: true });
  const futureState = {
    _schemaVersion: 99,
    taskId,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requirements: { r: true },
    context: { c: true },
    evidence: { e: true },
  };
  await writeFile(join(badDir, "wam-state.json"), JSON.stringify(futureState, null, 2), "utf8");

  const c = await spawnChild(root, "load", taskId);
  assert.equal(c.code, 0, "child exits 0 with schema mismatch");
  // The future schema version is preserved and reported by the fresh process.
  assert.ok(c.out.includes("SENTINEL_SCHEMA 99"), "future schema version reported");
  assert.ok(c.out.includes("SENTINEL_RESUME resumable=true"), "resumeSession handles unknown schema");
  assert.ok(c.out.includes(`SENTINEL_TASKID ${taskId}`), "taskId survives schema mismatch");
});
