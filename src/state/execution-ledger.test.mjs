import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyEvents,
  emptyExecutionLedger,
  executionLedgerPath,
  loadExecutionLedger,
  projectExecution,
  saveExecutionLedger,
} from "./execution-ledger.js";

const TASK = "task-1";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-ledger-"));
}

function evt(id, type, data = {}, at = 1) {
  return { id, type, at, taskId: TASK, data };
}

function fullSequence() {
  return [
    evt("e1", "CLAIM_CREATED", { requirementId: "req-1", claim: "build it" }, 1),
    evt("e2", "ACTION_STARTED", { requirementId: "req-1", summary: "edit" }, 2),
    evt("e3", "OBSERVATION_CREATED", { requirementId: "req-1", summary: "looks right" }, 3),
    evt("e4", "EVIDENCE_ADDED", { requirementId: "req-1", ref: "test.log" }, 4),
    evt("e5", "VERIFICATION_STARTED", { requirementId: "req-1" }, 5),
    evt("e6", "VERIFICATION_COMPLETED", { requirementId: "req-1" }, 6),
  ];
}

test("full claim→action→observation→evidence→verification sequence yields VERIFIED", () => {
  const ledger = applyEvents(emptyExecutionLedger(TASK), fullSequence());
  assert.equal(ledger.requirements["req-1"].status, "VERIFIED");
  assert.equal(ledger.requirements["req-1"].actions.length, 1);
  assert.equal(ledger.requirements["req-1"].observations.length, 1);
  assert.deepEqual(projectExecution(ledger).pendingObligations, []);
});

test("duplicate event ids are idempotent and do not double-append", () => {
  const events = fullSequence();
  const once = applyEvents(emptyExecutionLedger(TASK), events);
  const twice = applyEvents(once, events);
  assert.deepEqual(twice.requirements["req-1"].actions, once.requirements["req-1"].actions);
  assert.deepEqual(twice.requirements["req-1"].evidence, once.requirements["req-1"].evidence);
  assert.equal(twice.processedEventIds.length, events.length);
  assert.equal(twice.ignoredEvents, 0);
});

test("unknown and malformed events are ignored without throwing", () => {
  const ledger = applyEvents(emptyExecutionLedger(TASK), [
    { foo: "bar" },
    { id: "", type: "CLAIM_CREATED" },
    evt("x1", "NOT_A_TYPE", { requirementId: "req-1" }),
    evt("x2", "CLAIM_CREATED", { requirementId: "req-1" }),
    evt("x3", "CLAIM_CREATED", { requirementId: "req-1", claim: "ok" }),
  ]);
  assert.equal(ledger.requirements["req-1"].status, "OPEN");
  assert.equal(ledger.ignoredEvents, 4); // malformed x2, unknown type, claim-less claim
});

test("VERIFIED cannot be reached by skipping the transition chain", () => {
  const ledger = applyEvents(emptyExecutionLedger(TASK), [
    evt("e1", "CLAIM_CREATED", { requirementId: "req-1", claim: "build it" }, 1),
    evt("e2", "VERIFICATION_COMPLETED", { requirementId: "req-1" }, 2),
  ]);
  const req = ledger.requirements["req-1"];
  assert.equal(req.status, "OPEN");
  assert.equal(req.decisions.at(-1).decision, "verification-rejected");
});

test("evidence conflict surfaces in the projection and blocks completion", () => {
  const ledger = applyEvents(emptyExecutionLedger(TASK), [
    ...fullSequence().slice(0, 4),
    evt("c1", "EVIDENCE_CONFLICT", { requirementId: "req-1", ref: "other.log", reason: "mismatch" }, 5),
    evt("e6", "VERIFICATION_COMPLETED", { requirementId: "req-1" }, 6),
  ]);
  const projected = projectExecution(ledger);
  assert.equal(ledger.requirements["req-1"].status, "SUPPORTED");
  assert.deepEqual(projected.conflicts, [
    { requirementId: "req-1", eventId: "c1", ref: "other.log", note: "mismatch" },
  ]);
  assert.equal(projected.pendingObligations[0].reason, "unresolved evidence conflict");
  assert.notEqual(ledger.requirements["req-1"].status, "VERIFIED");
});

test("pending obligations list only non-verified requirements", () => {
  const ledger = applyEvents(emptyExecutionLedger(TASK), [
    ...fullSequence(),
    evt("e7", "CLAIM_CREATED", { requirementId: "req-2", claim: "second" }, 7),
  ]);
  const projected = projectExecution(ledger);
  assert.deepEqual(
    projected.pendingObligations.map((item) => item.requirementId),
    ["req-2"],
  );
  assert.deepEqual(projected.requirements.map((item) => item.id), ["req-1", "req-2"]);
});

test("applyEvents does not mutate its input ledger", () => {
  const base = emptyExecutionLedger(TASK);
  const snapshot = structuredClone(base);
  applyEvents(base, fullSequence());
  assert.deepEqual(base, snapshot);
});

test("persistence round-trips across a reload", () => {
  const root = tempRoot();
  const ledger = applyEvents(emptyExecutionLedger(TASK), fullSequence());
  saveExecutionLedger(root, ledger);
  const loaded = loadExecutionLedger(root, TASK);
  assert.deepEqual(loaded, ledger);
  assert.deepEqual(projectExecution(loaded), projectExecution(ledger));
});

test("corrupt ledger file throws", () => {
  const root = tempRoot();
  const file = executionLedgerPath(root, TASK);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "{not json");
  assert.throws(() => loadExecutionLedger(root, TASK), /Corrupt execution ledger/);
});

test("legacy task without a ledger gets an empty one", () => {
  const loaded = loadExecutionLedger(tempRoot(), "legacy-task");
  assert.deepEqual(loaded, emptyExecutionLedger("legacy-task"));
  assert.deepEqual(projectExecution(loaded), {
    taskId: "legacy-task",
    requirements: [],
    pendingObligations: [],
    conflicts: [],
  });
});
