import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { filterNewContext } from "../../src/context/context-dedupe.js";

test("identical blocks are injected once per session", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dedupe-"));
  const first = filterNewContext(["skill block", "N1 project"], { root, sessionID: "s1" });
  const second = filterNewContext(["skill block", "N1 project"], { root, sessionID: "s1" });
  assert.deepEqual(first, ["skill block", "N1 project"]);
  assert.deepEqual(second, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("critical gate blocks are always kept", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dedupe-"));
  filterNewContext(["⛔ [wait-a-minute] COMPLETION GATE: faltan 1"], { root, sessionID: "s2" });
  const second = filterNewContext(["⛔ [wait-a-minute] COMPLETION GATE: faltan 1"], { root, sessionID: "s2" });
  assert.equal(second.length, 1);
  assert.match(second[0], /COMPLETION GATE/);
  fs.rmSync(root, { recursive: true, force: true });
});

test("CQE file list and summary collapse by file set", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dedupe-"));
  const full = [
    "[wam cqe file_context: 2 archivos en 64ms, fuente cqe]",
    "  - benchmarks/retrieval/search-baseline.mjs:1 (score 0.9, ~8 tok) /**",
    "  - tests/unit/context-manager.test.mjs:1 (score 0.9, ~14 tok) import {",
  ].join("\n");
  const summary =
    "cqe: 2 archivos en 64ms (fuente cqe) — top: benchmarks/retrieval/search-baseline.mjs, tests/unit/context-manager.test.mjs";
  const first = filterNewContext([full], { root, sessionID: "s3" });
  const second = filterNewContext([summary], { root, sessionID: "s3" });
  assert.equal(first.length, 1);
  assert.equal(second.length, 0, "summary with the same file set must be deduped");
  fs.rmSync(root, { recursive: true, force: true });
});

test("CQE blocks with different file sets are both kept", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dedupe-"));
  const first = filterNewContext(
    ["cqe: 2 archivos en 12ms — top: src/a.mjs, src/b.mjs"],
    { root, sessionID: "s4" }
  );
  const second = filterNewContext(
    ["cqe: 2 archivos en 15ms — top: src/c.mjs, src/d.mjs"],
    { root, sessionID: "s4" }
  );
  assert.equal(first.length, 1);
  assert.equal(second.length, 1, "different file sets must both survive");
  fs.rmSync(root, { recursive: true, force: true });
});
