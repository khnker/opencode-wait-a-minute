import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { initMemory, addRecentChange } from "../../src/persistence/memory.js";

test("recent-changes.md keeps the newest 50 sections", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-recent-"));
  initMemory(root);

  for (let i = 0; i < 60; i++) {
    const day = String((i % 28) + 1).padStart(2, "0");
    addRecentChange(
      { date: `2026-01-${day}`, scope: `scope-${i}`, changes: [`change-${i}`] },
      root
    );
  }

  const body = fs.readFileSync(
    path.join(root, ".wam", "context", "recent-changes.md"),
    "utf8"
  );
  const count = (body.match(/^## /gm) || []).length;
  assert.ok(count <= 50, `expected <= 50 sections, got ${count}`);
  fs.rmSync(root, { recursive: true, force: true });
});
