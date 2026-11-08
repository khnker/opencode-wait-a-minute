/**
 * Completion gate — opt-in enforcement mode.
 *
 * The default path stays advisory (zero friction). With `completionGate.enforce`
 * on, a strict blocked verdict stays blocked and the validation text is a
 * directive instead of a recommendation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { persistTaskState, getTaskState } from "../../src/skills/engine.js";
import {
  evaluateCompletionGate,
  buildCompletionValidation,
} from "../../src/integration/orchestration.js";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wam-gate-enforce-"));

function blockedState() {
  return {
    phase: "IMPLEMENTING",
    contract: { status: "APPROVED", checks: [], unknowns: [], assumptions: [] },
    requirements: [{ id: "R1", title: "demo", status: "pending", evidence: [] }],
  };
}

function doneState(taskId) {
  persistTaskState(
    taskId,
    {
      phase: "VERIFYING",
      contract: { status: "APPROVED", checks: [], unknowns: [], assumptions: [] },
      requirements: [{ id: "R1", title: "demo", status: "verified", evidence: ["tests pass"] }],
      evidence: [{ criterionId: "outcome-evaluation", status: "VERIFIED", timestamp: Date.now() }],
    },
    TMP,
  );
  return getTaskState(taskId, TMP);
}

test("default mode keeps the advisory downgrade", () => {
  const gate = evaluateCompletionGate(blockedState(), "DONE");
  assert.equal(gate.blocked, false);
  assert.equal(gate.advisory, true);
  assert.match(gate.recommendation, /procedo/);
});

test("enforce mode blocks an unverified DONE claim", () => {
  const gate = evaluateCompletionGate(blockedState(), "DONE", { enforce: true });
  assert.equal(gate.blocked, true);
  assert.equal(gate.advisory, false);
  assert.equal(gate.ok, false);
  assert.ok(gate.pending.some((p) => p.includes("R1")), JSON.stringify(gate.pending));
});

test("enforce mode allows a fully verified DONE claim", () => {
  const gate = evaluateCompletionGate(doneState("enforce-done"), "DONE", { enforce: true });
  assert.equal(gate.blocked, false);
  assert.equal(gate.allDone, true);
});

test("enforce mode merges quality reasons without duplicates", () => {
  const gate = evaluateCompletionGate(blockedState(), "DONE", {
    enforce: true,
    quality: { enabled: true, sufficient: false, reasons: ["R1 — demo", "quality gap"] },
  });
  assert.equal(gate.blocked, true);
  assert.equal(gate.pending.length, 2);
  assert.ok(gate.pending.includes("quality gap"));
});

test("blocked validation is directive, advisory is a recommendation", () => {
  const blocked = buildCompletionValidation(
    { blocked: true, advisory: false, pending: ["R1 — demo"] },
    { nextAction: "verificar R1" },
  );
  assert.match(blocked.text, /⛔/);
  assert.match(blocked.text, /No declares DONE/);
  assert.match(blocked.text, /R1 — demo/);

  const advisory = buildCompletionValidation(
    { blocked: false, advisory: true, pending: ["R1 — demo"] },
    { nextAction: "verificar R1" },
  );
  assert.match(advisory.text, /Recomendación/);
  assert.doesNotMatch(advisory.text, /⛔/);
});
