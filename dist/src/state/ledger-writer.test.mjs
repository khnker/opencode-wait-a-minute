import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executionLedgerPath,
  loadExecutionLedger,
  projectExecution,
} from "./execution-ledger.js";
import {
  recordRequirementStatus,
  resetExecutionLedger,
  seedRequirements,
} from "./ledger-writer.js";

const TASK = "task-writer";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-ledger-writer-"));
}

const REQUIREMENTS = [
  { id: "req-1", title: "Build the thing" },
  { id: "req-2", title: "Verify the thing" },
];

test("seedRequirements records one claim per requirement", () => {
  const root = tempRoot();
  const ledger = seedRequirements(root, TASK, REQUIREMENTS);

  assert.equal(Object.keys(ledger.requirements).length, 2);
  assert.equal(ledger.requirements["req-1"].claim, "Build the thing");
  assert.equal(ledger.requirements["req-1"].status, "OPEN");
  assert.equal(ledger.processedEventIds.length, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(executionLedgerPath(root, TASK), "utf8")).taskId, TASK);
});

test("seedRequirements is idempotent", () => {
  const root = tempRoot();
  const first = seedRequirements(root, TASK, REQUIREMENTS);
  const second = seedRequirements(root, TASK, REQUIREMENTS);

  assert.equal(second.processedEventIds.length, first.processedEventIds.length);
  assert.equal(Object.keys(second.requirements).length, 2);
});

test("done stores evidence and reaches SUPPORTED", () => {
  const root = tempRoot();
  seedRequirements(root, TASK, REQUIREMENTS);
  const ledger = recordRequirementStatus(root, TASK, {
    requirementId: "req-1",
    status: "done",
    evidence: "tests pass",
  });

  const requirement = ledger.requirements["req-1"];
  assert.equal(requirement.status, "SUPPORTED");
  assert.equal(requirement.evidence.at(-1).ref, "tests pass");
  assert.equal(requirement.actions.length, 1);
});

test("verified reaches VERIFIED with no pending obligation", () => {
  const root = tempRoot();
  seedRequirements(root, TASK, REQUIREMENTS);
  recordRequirementStatus(root, TASK, {
    requirementId: "req-1",
    status: "done",
    evidence: "tests pass",
  });
  const ledger = recordRequirementStatus(root, TASK, {
    requirementId: "req-1",
    status: "verified",
    evidence: "suite green",
  });

  assert.equal(ledger.requirements["req-1"].status, "VERIFIED");
  const projection = projectExecution(ledger);
  assert.deepEqual(
    projection.pendingObligations.filter((item) => item.requirementId === "req-1"),
    [],
  );
});

test("a verified requirement can be reset to OPEN", () => {
  const root = tempRoot();
  seedRequirements(root, TASK, REQUIREMENTS);
  recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "done", evidence: "a" });
  recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "verified", evidence: "b" });
  const ledger = recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "pending" });

  assert.equal(ledger.requirements["req-1"].status, "OPEN");
});

test("unknown requirement ids are lazily seeded", () => {
  const root = tempRoot();
  const ledger = recordRequirementStatus(root, TASK, {
    requirementId: "req-9",
    status: "done",
    evidence: "seeded on demand",
  });

  assert.equal(ledger.requirements["req-9"].status, "SUPPORTED");
  assert.equal(ledger.requirements["req-9"].claim, "req-9");
});

test("unknown or missing status is a no-op", () => {
  const root = tempRoot();
  seedRequirements(root, TASK, REQUIREMENTS);
  const ledger = recordRequirementStatus(root, TASK, { requirementId: "req-1", status: "bogus" });

  assert.equal(ledger.requirements["req-1"].status, "OPEN");
  assert.equal(ledger.processedEventIds.length, 2);
});

test("resetExecutionLedger removes the file", () => {
  const root = tempRoot();
  seedRequirements(root, TASK, REQUIREMENTS);
  assert.equal(fs.existsSync(executionLedgerPath(root, TASK)), true);

  resetExecutionLedger(root, TASK);
  assert.equal(fs.existsSync(executionLedgerPath(root, TASK)), false);
  assert.deepEqual(loadExecutionLedger(root, TASK).requirements, {});
});
