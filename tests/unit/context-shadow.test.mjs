import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PROJECTION_MODES,
  resolveProjectionMode,
  buildShadowRecord,
  appendShadowRecord,
} from "../../src/context/context-shadow.js";

test("resolveProjectionMode defaults to active", () => {
  assert.equal(resolveProjectionMode(), "active");
  assert.equal(resolveProjectionMode(undefined), "active");
  assert.equal(resolveProjectionMode(""), "active");
});

test("resolveProjectionMode accepts every declared mode", () => {
  assert.deepEqual([...PROJECTION_MODES], ["legacy", "shadow", "active"]);
  for (const mode of PROJECTION_MODES) {
    assert.equal(resolveProjectionMode(mode), mode);
    assert.equal(resolveProjectionMode(`  ${mode.toUpperCase()} `), mode);
  }
});

test("invalid projection mode falls back to active and reports a diagnostic", () => {
  let reported;
  const mode = resolveProjectionMode("turbo", { onInvalid: (value) => (reported = value) });
  assert.equal(mode, "active");
  assert.equal(reported, "turbo");
});

test("buildShadowRecord is deterministic with an injected clock and hashes both texts", () => {
  const projection = {
    requirements: [{ id: "req-1" }],
    pending: [{ requirementId: "req-2" }],
    conflicts: [],
    decisions: [{ id: "d1", text: "keep" }],
    constraints: [{ text: "a" }, { text: "b" }],
    retrievableRefs: ["src/a.js", "src/b.js"],
  };
  const args = {
    now: () => "2026-01-01T00:00:00.000Z",
    sessionId: "ses-1",
    taskId: "task-1",
    mode: "shadow",
    budgetChars: 4000,
    injectedText: "legacy brief",
    shadowText: "projection brief",
    projection,
    taskState: { requirements: [{ id: "req-1" }, { id: "req-2" }] },
    decisions: [{ id: "d1" }, { id: "d2" }],
  };

  const first = buildShadowRecord(args);
  const second = buildShadowRecord(args);

  assert.deepEqual(first, second);
  assert.equal(first.timestamp, "2026-01-01T00:00:00.000Z");
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.mode, "shadow");
  assert.equal(first.injectedChars, "legacy brief".length);
  assert.equal(first.shadowChars, "projection brief".length);
  assert.equal(first.deltaChars, first.shadowChars - first.injectedChars);
  assert.match(first.injectedHash, /^[a-f0-9]{64}$/);
  assert.match(first.shadowHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.injectedHash, first.shadowHash);
  assert.equal(first.equivalent, false);
  assert.deepEqual(first.requirements, {
    included: ["req-1"],
    omitted: ["req-2"],
    pending: 1,
    conflicts: 0,
  });
  assert.deepEqual(first.decisions, { live: 1, dropped: 1 });
  assert.equal(first.constraints, 2);
  assert.equal(first.retrievableRefs, 2);
  assert.equal(first.injectedTokenEstimate, 3);
});

test("buildShadowRecord marks identical texts as equivalent", () => {
  const record = buildShadowRecord({ injectedText: "same", shadowText: "same", now: () => "t" });
  assert.equal(record.equivalent, true);
  assert.equal(record.deltaChars, 0);
});

test("appendShadowRecord honors WAM_METRICS_DIR and writes one JSON object per line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-shadow-unit-"));
  const previous = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = dir;
  try {
    assert.equal(appendShadowRecord("/does/not/matter", { schemaVersion: 1, n: 1 }), true);
    assert.equal(appendShadowRecord("/does/not/matter", { schemaVersion: 1, n: 2 }), true);
    const lines = fs
      .readFileSync(path.join(dir, "context-shadow.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(lines.map((line) => line.n), [1, 2]);
  } finally {
    if (previous === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("appendShadowRecord is fail-soft when the destination is unwritable", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-shadow-fail-"));
  const file = path.join(dir, "blocker");
  fs.writeFileSync(file, "not a directory");
  const previous = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = path.join(file, "nested");
  try {
    assert.doesNotThrow(() => appendShadowRecord(dir, { schemaVersion: 1 }));
    assert.equal(appendShadowRecord(dir, { schemaVersion: 1 }), false);
  } finally {
    if (previous === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
