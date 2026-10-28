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
