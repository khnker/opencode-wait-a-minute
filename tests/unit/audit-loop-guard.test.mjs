import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAuditCoalescer } from "../../src/persistence/audit-coalescer.js";

/*
 * Tests inject a fake/in-memory fs to prove the coalescer's contract:
 *  - buffers entries and flushes on maxEntries (size threshold)
 *  - explicit flush() writes the pending batch
 *  - skips when the target dir is missing
 *  - skips when serialized content is unchanged (idempotency)
 *  - capTaskDirs evicts oldest-by-mtime to stay under the cap
 *  - malformed / non-serializable entries never throw
 */

function makeInjectedFs(realFs = fs) {
  // A real-fs wrapper that records writes; still uses the real disk so
  // access/exist checks are authentic, but lets tests observe calls.
  const writes = [];
  const injected = {
    constants: realFs.constants,
    existsSync: (p) => realFs.existsSync(p),
    accessSync: (p, m) => realFs.accessSync(p, m),
    mkdirSync: (p, o) => realFs.mkdirSync(p, o),
    statSync: (p) => realFs.statSync(p),
    readdirSync: (p, o) => realFs.readdirSync(p, o),
    rmSync: (p, o) => realFs.rmSync(p, o),
    utimesSync: (p, a, b) => realFs.utimesSync(p, a, b),
    writeFileSync: (p, data) => {
      writes.push(p);
      realFs.writeFileSync(p, data);
    },
    reads: writes,
  };
  return injected;
}

test("flush on size threshold (maxEntries)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coalescer-size-"));
  const filePath = path.join(tmp, "default.json");
  const injected = makeInjectedFs(fs);
  const coalescer = createAuditCoalescer({
    maxEntries: 3,
    maxBytes: 65536,
    idleMs: 60_000, // disable idle trigger; size must drive the flush
    dirPath: tmp,
    filePath,
    now: Date.now,
    fs: injected,
  });

  const r1 = coalescer.push({ type: "A" });
  assert.equal(r1.buffered, 1);
  assert.equal(r1.flushed, false);
  assert.equal(fs.existsSync(filePath), false);

  const r2 = coalescer.push({ type: "B" });
  assert.equal(r2.buffered, 2);
  assert.equal(r2.flushed, false);

  const r3 = coalescer.push({ type: "C" });
  assert.equal(r3.buffered, 0, "buffer resets after flush");
  assert.equal(r3.flushed, true);

  const written = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(written.length, 3);
  assert.deepEqual(written.map((e) => e.type), ["A", "B", "C"]);
  assert.equal(injected.reads.length, 1, "exactly one write per batch");

  coalescer.reset();
});

test("flush on idle / explicit flush()", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coalescer-idle-"));
  const filePath = path.join(tmp, "default.json");

  // Inject a fake clock so idle is deterministic without waiting 2s.
  let clock = 1_000;
  const fakeNow = () => clock;
  const coalescer = createAuditCoalescer({
    maxEntries: 100,
    maxBytes: 65536,
    idleMs: 5,
    dirPath: tmp,
    filePath,
    now: fakeNow,
    fs,
  });

  clock = 1_000;
  const r1 = coalescer.push({ type: "A" });
  assert.equal(r1.flushed, false, "first push within idle window buffers");
  assert.equal(fs.existsSync(filePath), false);

  // Advance past the idle threshold, next push triggers idle flush of [A, B].
  clock = 1_010;
  const r2 = coalescer.push({ type: "B" });
  assert.equal(r2.flushed, true, "idle threshold reached -> flush");
  let written = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.deepEqual(written.map((e) => e.type), ["A", "B"]);

  // Explicit flush writes the current pending batch.
  coalescer.push({ type: "C" });
  const f = coalescer.flush();
  assert.equal(f.written, true);
  assert.equal(f.reason, "ok");
  assert.equal(f.entries, 1);
  written = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.deepEqual(written.map((e) => e.type), ["C"]);
});

test("skip flush when directory missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coalescer-missing-"));
  const missingDir = path.join(tmp, "no-such-dir");
  const filePath = path.join(missingDir, "default.json");
  const coalescer = createAuditCoalescer({
    maxEntries: 1,
    idleMs: 60_000,
    dirPath: missingDir,
    filePath,
    fs,
  });

  coalescer.push({ type: "A" });
  const f = coalescer.flush();
  assert.equal(f.written, false);
  assert.equal(f.reason, "dir-missing");
  assert.equal(fs.existsSync(filePath), false);
});

test("skip flush when content unchanged (idempotent)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coalescer-idem-"));
  const filePath = path.join(tmp, "default.json");
  const injected = makeInjectedFs(fs);
  const coalescer = createAuditCoalescer({
    maxEntries: 100,
    idleMs: 60_000,
    dirPath: tmp,
    filePath,
    fs: injected,
  });

  coalescer.push({ type: "A" });
  const f1 = coalescer.flush();
  assert.equal(f1.written, true);
  assert.equal(f1.reason, "ok");

  // Identical entry -> identical serialized content -> skipped.
  coalescer.push({ type: "A" });
  const f2 = coalescer.flush();
  assert.equal(f2.written, false);
  assert.equal(f2.reason, "unchanged");
  assert.equal(injected.reads.length, 1, "no second write for identical content");
});

test("capTaskDirs evicts oldest by mtime until under cap", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "task-cap-"));
  const tasksDir = path.join(tmp, ".wam", "tasks");
  fs.mkdirSync(tasksDir, { recursive: true });

  for (let i = 1; i <= 5; i++) {
    const d = path.join(tasksDir, `task-${i}`);
    fs.mkdirSync(d, { recursive: true });
    const past = new Date(Date.now() - (10 - i) * 1000);
    fs.utimesSync(d, past, past);
  }

  const coalescer = createAuditCoalescer({
    dirPath: tmp,
    maxTaskDirs: 3,
    fs,
  });

  const res = coalescer.capTaskDirs(tasksDir);
  assert.equal(res.removed, 2);
  assert.equal(res.remaining, 3);

  // Oldest (task-1, task-2) evicted; newest three remain.
  assert.equal(fs.existsSync(path.join(tasksDir, "task-1")), false);
  assert.equal(fs.existsSync(path.join(tasksDir, "task-2")), false);
  assert.equal(fs.existsSync(path.join(tasksDir, "task-3")), true);
  assert.equal(fs.existsSync(path.join(tasksDir, "task-4")), true);
  assert.equal(fs.existsSync(path.join(tasksDir, "task-5")), true);
});

test("malformed / non-serializable entry does not throw", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "coalescer-safe-"));
  const filePath = path.join(tmp, "default.json");
  const coalescer = createAuditCoalescer({
    maxEntries: 100,
    idleMs: 60_000,
    dirPath: tmp,
    filePath,
    fs,
  });

  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => {
    coalescer.push({ type: "CIRCULAR", circular });
    coalescer.flush();
  });
  // Fail-open: subsequent good entries still flush.
  coalescer.push({ type: "GOOD" });
  const f = coalescer.flush();
  assert.equal(f.written, true);
});
