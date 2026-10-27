import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  retrieveIntentHistory,
  loadHistoryEntries,
} from "../../src/context/intent-history.js";

test("relevant history outranks unrelated history", () => {
  const now = Date.now();
  const entries = [
    { text: "OAuth2 token rotation decision", timestamp: new Date(now).toISOString(), source: "decision" },
    { text: "dashboard colors and typography", timestamp: new Date(now).toISOString(), source: "recent" },
  ];
  const result = retrieveIntentHistory(entries, "OAuth2 token rotation", { threshold: 0.2, now });
  assert.equal(result[0].source, "decision");
  assert.ok(!result.some((r) => r.source === "recent"));
});

test("loadHistoryEntries reads recent changes and task contracts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-history-"));
  fs.mkdirSync(path.join(root, ".wam", "context"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".wam", "context", "recent-changes.md"),
    "# Recent Changes\n\n## 2026-10-27 — task-1\n- OAuth2 token rotation\n"
  );
  fs.mkdirSync(path.join(root, ".wam", "tasks", "task-2"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".wam", "tasks", "task-2", "task.json"),
    JSON.stringify({
      contract: { objective: "Implement OAuth2 endpoint", requirements: ["token validation"] },
      lastAction: "implementa OAuth2",
    })
  );

  const entries = loadHistoryEntries(root, { taskId: "task-2" });
  assert.ok(entries.some((e) => e.source === "task:task-2"));

  const recentEntries = loadHistoryEntries(root, { taskId: "task-1" });
  assert.ok(recentEntries.some((e) => e.source === "recent-changes"));
  fs.rmSync(root, { recursive: true, force: true });
});
