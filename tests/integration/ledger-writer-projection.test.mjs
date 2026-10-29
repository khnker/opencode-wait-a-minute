import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContextBrief } from "../../src/context/context-brief.js";
import { saveTask } from "../../src/state/task-store.js";
import { recordRequirementStatus, seedRequirements } from "../../src/state/ledger-writer.js";

const TASK = "task-ledger-projection";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-ledger-projection-"));
}

test("writer makes the semantic projection reachable", () => {
  const root = tempRoot();
  const taskState = {
    taskId: TASK,
    phase: "IMPLEMENTING",
    contract: { status: "APPROVED", objective: "Ship the writer", constraints: [] },
    requirements: [
      { id: "req-1", title: "Write the ledger", status: "verified", evidence: ["tests pass"] },
      { id: "req-2", title: "Shadow telemetry shows available", status: "pending", evidence: [] },
    ],
  };
  saveTask(TASK, taskState, root);

  seedRequirements(root, TASK, taskState.requirements);
  recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "done", evidence: "tests pass" });
  recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "verified", evidence: "suite green" });

  const brief = buildContextBrief({
    taskId: TASK,
    taskState,
    decisions: [],
    root,
    projectionMode: "active",
  });

  assert.ok(brief.projection, "projection should be available once the ledger exists");
  assert.equal(brief.fallbackReason, null);
  assert.match(brief.text, /req-1/);
  assert.match(brief.text, /req-2/);
});
