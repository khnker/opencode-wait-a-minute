/**
 * Verification Engine ↔ Completion Gate — WAM 1.1 (Phase 3 + 4 + 7 completion tests).
 *
 * Ejecutar: node --test verification-completion.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pluginDefault from "../../index.js";
import { evaluateRequirement as evaluateRequirementChecks } from "../../src/verification/verification.js";
import { persistTaskState } from "../../src/skills/engine.js";

const evaluateRequirement = evaluateRequirementChecks;

const CWD = process.cwd();
const cleanup = (taskId) => {
  try { fs.rmSync(path.join(CWD, ".wam", "tasks", taskId), { recursive: true, force: true }); } catch {}
  try { fs.rmSync(path.join(CWD, ".wam", "active-task"), { force: true }); } catch {}
};

function makeState({ checks = [], reqStatus = "done", reqEvidence = ["manual"] } = {}) {
  return {
    contract: {
      status: "APPROVED",
      checks,
      requirements: [{ id: "R1", title: "demo" }],
      verification: ["R1"],
      unknowns: [],
      assumptions: [],
    },
    requirements: [{ id: "R1", title: "demo", status: reqStatus, evidence: reqEvidence }],
  };
}

test("markRequirement ejecuta checks automáticamente al marcar verified", async () => {
  const taskId = "test-verified-auto";
  const state = makeState({ 
    checks: [{ id: "c1", reqId: "R1", type: "command", command: "node -e 'process.exit(0)'" }] 
  });
  persistTaskState(taskId, state, CWD);
  const r = await pluginDefault.markRequirement(taskId, "R1", "verified", "ejecutado", CWD, null);
  assert.equal(r.ok, true, `markRequirement.ok esperado true, got: ${JSON.stringify(r)}`);
  cleanup(taskId);
});

test("markRequirement rechaza verified cuando checks fallan", async () => {
  const taskId = "test-verified-fail";
  const state = makeState({ 
    checks: [{ id: "c1", reqId: "R1", type: "command", command: "node -e 'process.exit(1)'" }] 
  });
  persistTaskState(taskId, state, CWD);
  const r = await pluginDefault.markRequirement(taskId, "R1", "verified", "lo hice", CWD, null);
  assert.equal(r.ok, false, "verify debería rechazar con checks FAIL");
  assert.match(r.reason, /verificación falló/i);
  cleanup(taskId);
});

test("markRequirement marca `done` sin ejecutar checks", async () => {
  const taskId = "test-done-pass";
  const state = makeState({
    checks: [{ id: "c1", reqId: "R1", type: "command", command: "node -e 'process.exit(0)'" }],
  });
  persistTaskState(taskId, state, CWD);
  const r = await pluginDefault.markRequirement(taskId, "R1", "done", "ok", CWD, null);
  assert.equal(r.ok, true);
  cleanup(taskId);
});

test("evaluateCompletionGate advierte, no bloquea, si hay checks FAIL", () => {
  const state = makeState({ checks: [{ reqId: "R1", type: "command", status: "FAIL" }], reqStatus: "verified" });
  const g = pluginDefault.evaluateCompletionGate(state, "task complete");
  assert.equal(g.blocked, false, "el gate nunca bloquea");
  assert.equal(g.advisory, true, "el gate advierte");
  assert.ok(Array.isArray(g.pending) && g.pending.length > 0);
  assert.match(g.recommendation, /^Recomendación:/);
});

test("evaluateCompletionGate recomienda outcomeContract sin bloquear DONE", () => {
  // Sin outcomeContract el gate sólo recomienda (sin contrato implícito, nunca bloquea)
  const state = makeState({
    checks: [{ reqId: "R1", type: "command", status: "PASS" }],
    reqStatus: "verified",
  });
  const g = pluginDefault.evaluateCompletionGate(state, "task complete");
  assert.equal(g.blocked, false, "no bloquea sin outcomeContract");
  assert.equal(g.advisory, true);
  assert.match(g.recommendation, /^Recomendación:/);
  assert.ok(Array.isArray(g.pending) && g.pending.length > 0);

  // Con outcomeContract válido y ACHIEVED el gate permite DONE
  const state2 = makeState({
    checks: [{ reqId: "R1", type: "command", status: "PASS" }],
    reqStatus: "verified",
  });
  state2.outcomeContract = {
    taskId: "t1",
    objective: "Fix bug",
    acceptanceCriteria: [
      { id: "c1", description: "Bug fixed", mandatory: true },
    ],
  };
  state2.evidence = [{ criterionId: "c1", status: "VERIFIED", timestamp: Date.now() }];
  const g2 = pluginDefault.evaluateCompletionGate(state2, "task complete");
  assert.equal(g2.blocked, false, "gate debe permitir con ACHIEVED");
  assert.equal(g2.allDone, true);

  // Con outcomeContract NO_ACHIEVED el gate sólo advierte
  const state3 = makeState({
    checks: [{ reqId: "R1", type: "command", status: "PASS" }],
    reqStatus: "verified",
  });
  state3.outcomeContract = {
    taskId: "t3",
    objective: "Fail case",
    acceptanceCriteria: [{ id: "c1", description: "Should fail", mandatory: true }],
  };
  state3.evidence = [{ criterionId: "c1", status: "FAILED", timestamp: Date.now() }];
  const g3 = pluginDefault.evaluateCompletionGate(state3, "task complete");
  assert.equal(g3.blocked, false, "no bloquea con NOT_ACHIEVED");
  assert.equal(g3.advisory, true);
  assert.match(g3.recommendation, /^Recomendación:/);
  assert.ok(Array.isArray(g3.pending) && g3.pending.length > 0);
});

test("textual evidence NO produce VERIFIED si hay checks requeridos (sanity)", () => {
  const state = makeState({ checks: [{ reqId: "R1", type: "command", status: "PENDING" }], reqStatus: "verified" });
  const verdict = evaluateRequirementChecks(state.contract.checks, state.contract.checks);
  assert.equal(verdict.status, "VERIFYING", "PENDING debe mantenerse");
});
