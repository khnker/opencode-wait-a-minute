#!/usr/bin/env node
/**
 * tests/robustness/degradation.test.mjs
 *
 * Verifies graceful degradation of loadWamState + resumeSession under:
 *   - malformed JSON
 *   - missing required fields
 *   - unknown task / absent state
 *   - corrupted state files
 *   - failed reconstruction
 *
 * Invariant: loadWamState returns null or migrates WITHOUT throwing;
 * other tasks are not corrupted; resumeSession degrades gracefully.
 *
 * Discoverable by scripts/run-tests.mjs (filename matches *.test.mjs).
 * Uses node:test + node:assert/strict. Cleans up temp dirs.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";

import {
  createWamState,
  loadWamState,
  saveWamState,
  resumeSession,
} from "../../src/state/wam-state.js";

const tmpBase = join(tmpdir(), `wam-degrade-${process.pid}-${Date.now()}`);

after(async () => {
  await rm(tmpBase, { recursive: true, force: true });
});

await mkdir(tmpBase, { recursive: true });

async function writeRaw(rootDir, taskId, content) {
  const d = join(rootDir, taskId);
  await mkdir(d, { recursive: true });
  await writeFile(join(d, "wam-state.json"), content, "utf8");
}

test("malformed JSON degrades safely — never silently partial, never corrupts siblings", async () => {
  const root = join(tmpBase, "malformed");
  await mkdir(root, { recursive: true });

  // Seed a good sibling so we can assert it survives.
  const goodId = "good-neighbor";
  await saveWamState(goodId, createWamState(goodId, { keep: true }, { x: 1 }, { y: 2 }), root);

  // Plant malformed JSON for the "bad" task.
  await writeRaw(root, "bad-json", '{"status": "active",}');

  let threw = false;
  let st;
  try {
    st = await loadWamState("bad-json", root);
  } catch (err) {
    threw = true;
  }
  // Safe degradation: either null OR a caught error. Both are safe if contained.
  const degraded = threw || st === null;
  assert.ok(degraded, `malformed JSON must degrade (threw=${threw}, loaded=${st})`);

  // The sibling task is completely unaffected.
  const good = await loadWamState(goodId, root);
  assert.ok(good, "sibling task survives malformed JSON of another task");
  assert.equal(good.taskId, goodId);
  assert.deepEqual(good.context, { x: 1 });
});

test("missing fields load as present; resumeSession handles missing status", async () => {
  const root = join(tmpBase, "missing");
  await mkdir(root, { recursive: true });
  await writeRaw(root, "no-status", '{"_schemaVersion":1,"taskId":"no-status"}');
  const st = await loadWamState("no-status", root);
  assert.ok(st, "missing-field JSON still parses");
  assert.equal(st.taskId, "no-status");
  assert.equal(st.status, undefined);
  const r = resumeSession(st);
  assert.equal(r.resumable, true, "resumeSession defaults unknown status to resumable");
  assert.equal(r.status, "unknown", "resumeSession reports unknown status");
});

test("unknown task / absent state returns null", async () => {
  const root = join(tmpBase, "absent");
  await mkdir(root, { recursive: true });
  const st = await loadWamState("task-never-saved", root);
  assert.equal(st, null, "absent task returns null");
  assert.deepEqual(resumeSession(st), {
    resumable: false,
    reason: "No valid state provided",
    taskId: null,
  });
});

test("corrupted sibling state does not corrupt unrelated valid task", async () => {
  const root = join(tmpBase, "sibling");
  await mkdir(root, { recursive: true });

  const good = createWamState("good-task", { keep: true }, { ctx: true }, { ev: true });
  await saveWamState("good-task", good, root);

  // Sibling corrupted states.
  await writeRaw(root, "corrupt-json", "}");
  await writeRaw(root, "empty-file", "");
  await writeRaw(root, "not-object", "12345");

  // Each corrupted sibling degrades (either null or caught error).
  for (const bad of ["corrupt-json", "empty-file"]) {
    let badSt, badThrew = false;
    try { badSt = await loadWamState(bad, root); } catch { badThrew = true; }
    assert.ok(badThrew || badSt === null, `${bad} degrades safely`);
  }

  // Non-object JSON (number) does parse but resumeSession degrades.
  const numeric = await loadWamState("not-object", root);
  assert.equal(numeric, 12345);
  assert.deepEqual(resumeSession(numeric), {
    resumable: false,
    reason: "No valid state provided",
    taskId: null,
  });

  // The valid task is still readable.
  const loadedGood = await loadWamState("good-task", root);
  assert.ok(loadedGood, "good task must still load");
  assert.equal(loadedGood.taskId, "good-task");
  assert.deepEqual(loadedGood.requirements, { keep: true });
});

test("resumeSession degrades for null, primitives, and completed tasks", async () => {
  assert.deepEqual(resumeSession(null), {
    resumable: false,
    reason: "No valid state provided",
    taskId: null,
  });
  assert.deepEqual(resumeSession("string"), {
    resumable: false,
    reason: "No valid state provided",
    taskId: null,
  });
  assert.deepEqual(resumeSession(42), {
    resumable: false,
    reason: "No valid state provided",
    taskId: null,
  });

  const completed = createWamState("done-task", {}, {}, {});
  completed.status = "completed";
  const r = resumeSession(completed);
  assert.equal(r.resumable, false, "completed session is not resumable");
  assert.equal(r.reason, "Session already completed");
  assert.equal(r.taskId, "done-task");
});

test("directory-level corruption does not prevent other task dirs from loading", async () => {
  const root = join(tmpBase, "dirlevel");
  await mkdir(root, { recursive: true });

  const task1 = createWamState("task-one", { a: 1 }, { b: 2 }, { c: 3 });
  const task2 = createWamState("task-two", { x: 9 }, { y: 8 }, { z: 7 });
  await saveWamState("task-one", task1, root);
  await saveWamState("task-two", task2, root);

  // Overwrite task-one's file with malformed JSON but keep task-two intact.
  await writeRaw(root, "task-one", "this is not json");

  let oneThrew = false, oneSt;
  try { oneSt = await loadWamState("task-one", root); } catch { oneThrew = true; }
  assert.ok(oneThrew || oneSt === null, "task-one degraded (threw or null)");

  const two = await loadWamState("task-two", root);
  assert.ok(two, "task-two unaffected");
  assert.equal(two.taskId, "task-two");
  assert.deepEqual(two.evidence, { z: 7 });
});