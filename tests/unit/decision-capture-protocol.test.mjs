import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initMemory, recordDecision } from "../../src/persistence/memory.js";
import {
  validateDecisionEntry,
  validateDecisionsMarkdown,
  queryDecisions,
  exportDecisions,
  transitionDecisionStatus,
  detectDuplicateDecision,
  checkDecisionImpactConsistency,
} from "../../src/context/decision-capture-protocol.js";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-protocol-"));
}

test("validateDecisionEntry validates required fields and status", () => {
  const valid = validateDecisionEntry({
    id: "dec-1",
    status: "accepted",
    source: "user-decided",
    confidence: "high",
    decision: "Use SQLite",
  });
  assert.equal(valid.valid, true);

  const invalid = validateDecisionEntry({
    id: "",
    status: "unknown-status",
    confidence: "super-high",
    decision: "",
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length > 0);
});

test("queryDecisions filters decisions correctly", () => {
  const root = makeRoot();
  initMemory(root);
  recordDecision({
    id: "d1",
    decision: "Use REST API",
    status: "accepted",
    source: "architect-driven",
    confidence: "high",
  }, root);
  recordDecision({
    id: "d2",
    decision: "Use GraphQL",
    status: "proposed",
    source: "team-consensus",
    confidence: "medium",
  }, root);

  const accepted = queryDecisions({ status: "accepted" }, root);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, "d1");

  const searched = queryDecisions({ search: "GraphQL" }, root);
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, "d2");
});

test("exportDecisions supports json, csv, and markdown", () => {
  const root = makeRoot();
  initMemory(root);
  recordDecision({
    id: "d1",
    decision: "Use Redis",
    status: "accepted",
    source: "user-decided",
    confidence: "high",
    reason: "fast caching",
  }, root);

  const jsonOut = exportDecisions("json", root);
  const parsedJson = JSON.parse(jsonOut);
  assert.equal(parsedJson.length, 1);
  assert.equal(parsedJson[0].id, "d1");

  const csvOut = exportDecisions("csv", root);
  assert.ok(csvOut.includes("id,date,status"));
  assert.ok(csvOut.includes("d1"));

  const mdOut = exportDecisions("markdown", root);
  assert.ok(mdOut.includes("# Decision Log"));
  assert.ok(mdOut.includes("## d1"));
});

test("transitionDecisionStatus validates state machine transitions", () => {
  const root = makeRoot();
  initMemory(root);
  recordDecision({
    id: "d1",
    decision: "Use Auth0",
    status: "proposed",
  }, root);

  const invalidTransition = transitionDecisionStatus("d1", "superseded", root);
  assert.equal(invalidTransition.ok, false);

  const validTransition = transitionDecisionStatus("d1", "accepted", root);
  assert.equal(validTransition.ok, true);
  assert.equal(validTransition.decision.status, "accepted");
});

test("detectDuplicateDecision finds duplicate IDs or decision statements", () => {
  const root = makeRoot();
  initMemory(root);
  recordDecision({
    id: "d1",
    decision: "Use Postgres",
  }, root);

  const dup1 = detectDuplicateDecision({ id: "d1", decision: "Different text" }, root);
  assert.equal(dup1.duplicate, true);

  const dup2 = detectDuplicateDecision({ id: "d2", decision: "Use Postgres" }, root);
  assert.equal(dup2.duplicate, true);

  const unique = detectDuplicateDecision({ id: "d2", decision: "Use MySQL" }, root);
  assert.equal(unique.duplicate, false);
});

test("checkDecisionImpactConsistency detects issues in accepted decisions", () => {
  const root = makeRoot();
  initMemory(root);
  recordDecision({
    id: "d1",
    decision: "Risky choice",
    status: "accepted",
    confidence: "low",
    reason: "",
  }, root);

  const report = checkDecisionImpactConsistency(root);
  assert.ok(report.warnings.length > 0);
});
