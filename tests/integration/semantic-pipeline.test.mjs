import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContextBrief } from "../../src/context/context-brief.js";
import { applyEvents, emptyExecutionLedger, executionLedgerPath, loadExecutionLedger, projectExecution, saveExecutionLedger } from "../../src/state/execution-ledger.js";
import { acceptDelta, loadBase, materializeBase, proposeDelta, validateDelta } from "../../src/context/canonical-deltas.js";
import { applyRetentionPlan, planRetention } from "../../src/context/retention-policy.js";
import { consolidateTaskToGroup, getApplicableConstraints, setTaskParent } from "../../src/state/task-hierarchy.js";
import { loadTask, saveTask } from "../../src/state/task-store.js";
import { WAM_EVENTS } from "../../src/shared/wam-events.js";
const START = 1_700_000_000_000;
const PROJECT = "proj-pipeline";
const GROUP = "group-pipeline";
const TASK_A = "task-pipeline-a";
const TASK_B = "task-pipeline-b";
const SESSION = "session-pipeline";
const PROJECT_RULE = "project: no production writes";
const GROUP_RULE = "group: keep briefs under 4000 chars";
const SIBLING_SECRET = "zebra-salt-42";
const LIVE_REASON = "survives restarts";
const SUPERSEDED_DECISION = "Store sessions in JSON files";
const LIVE_FACT = "API base URL is /v2";
const UPDATED_FACT = "API base URL is /v3";
const INVALIDATED_FACT = "Legacy header X-Old-Token is current";
function eventFactory() {
  let seq = 0;
  return (type, requirementId, data = {}) => ({
    id: `evt-${String(++seq).padStart(3, "0")}`,
    type,
    requirementId,
    at: START + seq * 1000,
    data,
  });
}
function seedLedger(root, taskId, events) {
  const ledger = applyEvents(emptyExecutionLedger(taskId), events);
  saveExecutionLedger(root, ledger);
  return ledger;
}
test("semantic pipeline phases 1-7 compose end-to-end", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-semantic-pipeline-"));
  try {
    const ev = eventFactory();
    await t.test("1. task chain project -> group -> task -> session inherits constraints", () => {
      saveTask(PROJECT, { taskId: PROJECT, scope: "project", constraints: [PROJECT_RULE], requirements: [] }, root);
      saveTask(GROUP, { taskId: GROUP, scope: "group", constraints: [GROUP_RULE], requirements: [] }, root);
      saveTask(TASK_A, {
        taskId: TASK_A,
        scope: "task",
        phase: "IMPLEMENTING",
        nextAction: "resolve the rate-limit conflict",
        contract: { status: "APPROVED", objective: "Ship session tokens", constraints: ["no new deps"] },
        requirements: [
          { id: "req-verified-1", title: "Session token issuance", status: "verified" },
          { id: "req-pending-2", title: "Tenant rate limiting", status: "in_progress" },
        ],
      }, root);
      saveTask(SESSION, { taskId: SESSION, scope: "session", sessionId: SESSION }, root);
      saveTask(TASK_B, {
        taskId: TASK_B,
        scope: "task",
        contract: { status: "DRAFT", objective: `Sibling work ${SIBLING_SECRET}` },
        requirements: [],
      }, root);
      for (const [taskId, parentId] of [
        [GROUP, PROJECT],
        [TASK_A, GROUP],
        [SESSION, TASK_A],
        [TASK_B, GROUP],
      ]) {
        const linked = setTaskParent(root, taskId, parentId);
        assert.equal(linked.ok, true, `${taskId}: ${linked.errors?.join("; ")}`);
      }
      assert.deepEqual(getApplicableConstraints(root, TASK_A), [PROJECT_RULE, GROUP_RULE]);
      assert.deepEqual(getApplicableConstraints(root, SESSION), [PROJECT_RULE, GROUP_RULE]);
    });
    let ledgerA;
    await t.test("2. ledger reaches VERIFIED, keeps one pending and one conflict, survives restart", () => {
      ledgerA = seedLedger(root, TASK_A, [
        ev(WAM_EVENTS.CLAIM_CREATED, "req-verified-1", { claim: "POST /sessions returns a signed token" }),
        ev(WAM_EVENTS.ACTION_STARTED, "req-verified-1", { summary: "added the handler" }),
        ev(WAM_EVENTS.OBSERVATION_CREATED, "req-verified-1", { summary: "201 returned with a token" }),
        ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", {
          ref: "evidence-ref-1",
          note: "integration test passed",
        }),
        ev(WAM_EVENTS.VERIFICATION_STARTED, "req-verified-1", { note: "ran the test suite" }),
        ev(WAM_EVENTS.VERIFICATION_COMPLETED, "req-verified-1", { status: "VERIFIED" }),
        ev(WAM_EVENTS.CLAIM_CREATED, "req-pending-2", { claim: "Rate limit per tenant is enforced" }),
        ev(WAM_EVENTS.ACTION_STARTED, "req-pending-2", { summary: "drafted the limiter" }),
        ev(WAM_EVENTS.CLAIM_CREATED, "req-conflict-3", { claim: "Two limits agree" }),
        ev(WAM_EVENTS.EVIDENCE_CONFLICT, "req-conflict-3", {
          ref: "evidence-conflict-1",
          note: "two limits disagree",
        }),
      ]);
      seedLedger(root, TASK_B, [
        ev(WAM_EVENTS.CLAIM_CREATED, "req-sib-1", { claim: `Sibling only: ${SIBLING_SECRET}` }),
      ]);
      const reloaded = loadExecutionLedger(root, TASK_A);
      assert.deepEqual(reloaded, ledgerA);
      const projected = projectExecution(reloaded);
      assert.equal(projected.requirements.find((r) => r.id === "req-verified-1").status, "VERIFIED");
      assert.ok(projected.pendingObligations.some((p) => p.requirementId === "req-pending-2"));
      assert.ok(projected.conflicts.some((c) => c.ref === "evidence-conflict-1"));
      assert.deepEqual(projected, projectExecution(loadExecutionLedger(root, TASK_A)));
    });
    await t.test("3. retention blocks sole evidence and archives the archivable item with its ref", () => {
      const items = [
        { id: "claim-live", kind: "CLAIM", status: "accepted", retention: "active" },
        {
          id: "evidence-sole",
          kind: "EVIDENCE",
          retention: "ephemeral",
          sourceRefs: ["ref-sole-evidence"],
          relations: [{ type: "supports", targetId: "claim-live" }],
        },
        { id: "note-old", kind: "OBSERVATION", retention: "archivable", sourceRefs: ["ref-old-note"] },
      ];
      const plan = planRetention(items);
      const blocked = plan.blocked.find((entry) => entry.id === "evidence-sole");
      assert.ok(blocked, "sole evidence for a live claim must be blocked");
      assert.match(blocked.reason, /sole justification for live claim claim-live/);
      assert.ok(!plan.discard.includes("evidence-sole"));
      assert.deepEqual(plan.archive, ["note-old"]);
      const archived = applyRetentionPlan(items, plan).archived;
      assert.deepEqual(archived[0].sourceRefs, ["ref-old-note"]);
    });
    await t.test("4. canonical deltas bump versions and suppress the invalidated fact", async () => {
      const seed = await proposeDelta(root, [
        { op: "add", entry: { id: "fact-live", kind: "fact", text: LIVE_FACT, section: "api", source: "src/server.js" } },
        { op: "add", entry: { id: "fact-old", kind: "fact", text: INVALIDATED_FACT, section: "auth", source: "src/auth.js" } },
      ], { reason: "seed facts" });
      assert.equal((await validateDelta(root, seed.id)).ok, true);
      assert.equal((await acceptDelta(root, seed.id)).ok, true);
      const before = await loadBase(root);
      const update = await proposeDelta(root, [
        { op: "update", entryId: "fact-live", entry: { kind: "fact", text: UPDATED_FACT } },
      ], { reason: "api moved" });
      assert.equal(update.baseVersion, before.version);
      assert.deepEqual(await loadBase(root), before, "proposal must not mutate the base");
      assert.equal((await validateDelta(root, update.id)).ok, true);
      const acceptedUpdate = await acceptDelta(root, update.id, { decision: "adopt /v3" });
      assert.equal(acceptedUpdate.ok, true);
      assert.equal(acceptedUpdate.base.version, before.version + 1);
      assert.equal(acceptedUpdate.base.previousVersion, before.version);
      const invalidation = await proposeDelta(
        root,
        [{ op: "invalidate", entryId: "fact-old" }],
        { reason: "auth header replaced" },
      );
      assert.equal((await validateDelta(root, invalidation.id)).ok, true);
      assert.equal((await acceptDelta(root, invalidation.id)).ok, true);
      const base = await loadBase(root);
      assert.equal(base.entries.find((entry) => entry.id === "fact-old").status, "invalidated");
      assert.equal(base.entries.find((entry) => entry.id === "fact-old").invalidatedBy, invalidation.id);
      const rendered = await materializeBase(root);
      assert.ok(rendered.includes(UPDATED_FACT));
      assert.ok(!rendered.includes(INVALIDATED_FACT), "invalidated fact must not read as current");
    });
    const decisions = [
      { id: "dec-sqlite", status: "accepted", text: `Use SQLite — reason: ${LIVE_REASON}` },
      { id: "dec-json", status: "superseded", text: SUPERSEDED_DECISION },
    ];
    let briefA;
    await t.test("5. brief carries verified id, pending obligation, live reason, evidence and refs", async () => {
      const base = await loadBase(root);
      briefA = buildContextBrief({
        taskId: TASK_A,
        taskState: loadTask(TASK_A, root),
        decisions,
        root,
        base,
      });
      assert.ok(briefA.text.includes("req req-verified-1: VERIFIED"));
      assert.ok(briefA.text.includes("req-pending-2"));
      assert.ok(briefA.text.includes(LIVE_REASON));
      assert.ok(briefA.text.includes("evidence-ref-1"));
      assert.ok(briefA.text.includes("fact-live"), "active canonical fact is retrievable");
      assert.ok(briefA.text.includes(PROJECT_RULE));
      assert.ok(briefA.text.includes(GROUP_RULE));
      assert.ok(!briefA.text.includes(SUPERSEDED_DECISION));
      assert.ok(!briefA.text.includes(INVALIDATED_FACT));
      assert.ok(!briefA.text.includes(SIBLING_SECRET));
      assert.ok(briefA.text.length <= 4000, `brief is ${briefA.text.length} chars`);
    });
    await t.test("6. sibling task projection stays isolated", () => {
      const siblingBrief = buildContextBrief({
        taskId: TASK_B,
        taskState: loadTask(TASK_B, root),
        decisions: [],
        root,
      });
      assert.ok(!siblingBrief.text.includes("req-verified-1"));
      assert.ok(!siblingBrief.text.includes("req-pending-2"));
      assert.ok(!siblingBrief.text.includes("evidence-ref-1"));
      assert.ok(!briefA.text.includes(SIBLING_SECRET));
    });
    await t.test("7. consolidation reaches the group brief but not the sibling", () => {
      const consolidation = consolidateTaskToGroup(root, TASK_A);
      assert.equal(consolidation.ok, true, consolidation.errors?.join("; "));
      assert.equal(consolidation.entry.requirementsDone, 1);
      const groupState = loadTask(GROUP, root);
      assert.equal(groupState.consolidated.length, 1);
      const summary = `consolidated ${consolidation.entry.taskId}: ${consolidation.entry.requirementsDone} verified`;
      // Briefs have no consolidated renderer; callers promote the entry to the objective.
      const groupBrief = buildContextBrief({
        taskId: GROUP,
        taskState: { ...groupState, contract: { ...groupState.contract, objective: summary } },
        decisions: [],
      });
      assert.ok(groupBrief.text.includes(summary));
      const siblingState = loadTask(TASK_B, root);
      assert.equal(siblingState.consolidated, undefined);
      assert.ok(!buildContextBrief({ taskId: TASK_B, taskState: siblingState, decisions: [] }).text.includes(summary));
    });
    await t.test("8. corrupt ledger fails loud on load", () => {
      fs.writeFileSync(executionLedgerPath(root, TASK_A), "{ not json");
      assert.throws(() => loadExecutionLedger(root, TASK_A), /Corrupt execution ledger/);
    });
    await t.test("9. brief without ledger/root keeps the legacy output", () => {
      const legacy = buildContextBrief({
        taskId: TASK_A,
        taskState: loadTask(TASK_A, root),
        decisions,
      });
      assert.ok(!legacy.text.includes("[wam semantic projection]"));
      assert.ok(!legacy.text.includes("execution state"));
      assert.ok(!legacy.text.includes("evidence-ref-1"));
      assert.ok(legacy.text.includes("Ship session tokens"));
      assert.ok(legacy.text.includes(LIVE_REASON));
      assert.equal(
        buildContextBrief({ taskId: TASK_A, taskState: loadTask(TASK_A, root), decisions }).text,
        legacy.text,
      );
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
