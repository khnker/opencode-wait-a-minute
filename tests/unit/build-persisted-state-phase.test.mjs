import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { persistTaskState } from "../../src/skills/engine.js";

test("an approved contract is not left in PROPOSED", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-approved-"));
  const taskId = "task-approved-phase";
  try {
    persistTaskState(taskId, {
      id: taskId,
      taskId,
      phase: "PROPOSED",
      contract: {
        status: "APPROVED",
        objective: "implement the fix",
        requirements: ["do it"],
      },
      requirements: [
        { id: "req-1", title: "do it", status: "pending", evidence: [] },
      ],
    }, root);

    const merged = plugin.buildPersistedState(taskId, {}, root);

    assert.equal(merged.phase, "IMPLEMENTING");
    assert.match(merged.nextAction, /contrato aprobado/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
