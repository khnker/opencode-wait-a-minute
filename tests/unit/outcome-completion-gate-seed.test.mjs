/**
 * P0a — outcome contract seeding on persist unblocks the completion gate.
 *
 * Ejecutar: node --test outcome-completion-gate-seed.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { persistTaskState, getTaskState } from "../../src/skills/engine.js";
import { evaluateCompletionGate } from "../../src/integration/orchestration.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wam-outcome-seed-"));

function baseState(extra = {}) {
  return {
    phase: "IMPLEMENTING",
    contract: { status: "APPROVED", checks: [], unknowns: [], assumptions: [] },
    requirements: [{ id: "R1", title: "demo", status: "verified", evidence: ["done"] }],
    ...extra,
  };
}

test("persistTaskState seeds a valid outcomeContract", () => {
  const taskId = "seed-1";
  persistTaskState(taskId, baseState(), TMP);
  const s = getTaskState(taskId, TMP);
  assert.ok(s.outcomeContract, "outcomeContract must be seeded on persist");
  assert.equal(s.outcomeContract.taskId, taskId);
  assert.ok(s.outcomeContract.objective, "objective must be non-empty");
  assert.equal(s.outcomeContract.acceptanceCriteria.length, 1);
  assert.equal(s.outcomeContract.acceptanceCriteria[0].id, "outcome-evaluation");
  assert.equal(s.outcomeContract.acceptanceCriteria[0].mandatory, true);
});

test("seeded outcomeContract + verified evidence ⇒ allowed", () => {
  const taskId = "seed-allow";
  persistTaskState(
    taskId,
    baseState({
      evidence: [{ criterionId: "outcome-evaluation", status: "VERIFIED", timestamp: Date.now() }],
    }),
    TMP
  );
  const g = evaluateCompletionGate(getTaskState(taskId, TMP), "task complete");
  assert.equal(g.blocked, false, JSON.stringify(g));
  assert.equal(g.allDone, true);
});

test("task without outcomeContract ⇒ blocked with 'Missing outcome contract'", () => {
  const g = evaluateCompletionGate(baseState(), "task complete");
  assert.equal(g.blocked, true);
  assert.ok(
    (g.pending || []).some((p) => /missing outcome contract/i.test(p)),
    `expected missing-contract blocker, got: ${JSON.stringify(g.pending)}`
  );
});
