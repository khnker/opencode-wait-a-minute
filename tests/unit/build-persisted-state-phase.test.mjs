import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import plugin from "../../index.js";
import { getTaskState, persistTaskState } from "../../src/skills/engine.js";

function nonTrivialAnalysis() {
  return {
    intent: { classification: "feature" },
    strategy: "STANDARD",
    completionContract: {
      requirements: ["implement the fix"],
      verification: [],
    },
  };
}

test("a new non-trivial contract stays PROPOSED in advisory config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-proposed-"));
  const taskId = "task-new-proposed";
  try {
    // No options → default/advisory config: no blocking, no approval prompt.
    const fresh = plugin.buildPersistedState(taskId, nonTrivialAnalysis(), root);

    assert.equal(fresh.contract.status, "PROPOSED");
    assert.equal(fresh.phase, "IMPLEMENTING");
    assert.equal(fresh.contract.approvedBy, undefined);
    assert.equal(getTaskState(taskId, root).contract.status, "PROPOSED");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a new non-trivial contract advances IMPLEMENTING regardless of config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-required-"));
  const taskId = "task-new-required";
  try {
    const fresh = plugin.buildPersistedState(taskId, nonTrivialAnalysis(), root, {
      requireApproval: true,
    });

    assert.equal(fresh.contract.status, "PROPOSED");
    assert.equal(fresh.phase, "IMPLEMENTING");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("/wam contract approve is the only path to APPROVED", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-explicit-approve-"));
  const taskId = "task-explicit-approve";
  try {
    plugin.buildPersistedState(taskId, nonTrivialAnalysis(), root);
    assert.equal(getTaskState(taskId, root).contract.status, "PROPOSED");

    const approved = plugin.approveContract(taskId, root);

    assert.equal(approved.ok, true);
    const state = getTaskState(taskId, root);
    assert.equal(state.contract.status, "APPROVED");
    assert.equal(state.phase, "IMPLEMENTING");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

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

    const merged = plugin.buildPersistedState(taskId, nonTrivialAnalysis(), root);

    assert.equal(merged.contract.status, "APPROVED");
    assert.equal(merged.phase, "IMPLEMENTING");
    assert.match(merged.nextAction, /contrato aprobado/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
