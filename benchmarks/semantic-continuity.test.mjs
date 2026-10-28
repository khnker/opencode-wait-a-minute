/**
 * Semantic continuity benchmark.
 *
 * Builds one temp-root fixture with the real modules and compares the legacy
 * brief against the semantic projection under the same budget and probes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildContextBrief } from "../src/context/context-brief.js";
import {
  applyEvents,
  emptyExecutionLedger,
  loadExecutionLedger,
  saveExecutionLedger,
} from "../src/state/execution-ledger.js";
import { acceptDelta, loadBase, proposeDelta, validateDelta } from "../src/context/canonical-deltas.js";
import { createState } from "../src/state/task-state.js";
import { loadTask, saveTask } from "../src/state/task-store.js";
import { consolidateTaskToGroup } from "../src/state/task-hierarchy.js";
import { applyRetentionPlan, planRetention } from "../src/context/retention-policy.js";
import { WAM_EVENTS } from "../src/shared/wam-events.js";

const TASK_ID = "task-continuity";
const GROUP_ID = "group-work";
const SIBLING_ID = "task-sibling";
const BUDGET_CHARS = 4000;
const BUDGET_TOKENS = BUDGET_CHARS / 4;

const SIBLING_SECRET = "zebra-salt-42";
const ACTIVE_FACT = "API base URL is /v2";
const INVALIDATED_FACT = "Legacy auth header X-Old-Token is current";
const SUPERSEDED_DECISION = "Store sessions in JSON files";
const LIVE_REASON = "survives restarts";

const START = 1_700_000_000_000;

const tokens = (text) => Math.ceil(String(text || "").length / 4);

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

async function seedBase(root) {
  const seeded = await proposeDelta(
    root,
    [
      {
        op: "add",
        entry: { id: "fact-api-v2", kind: "fact", section: "api", source: "src/server.js", text: ACTIVE_FACT },
      },
      {
        op: "add",
        entry: { id: "fact-auth-old", kind: "fact", section: "auth", source: "src/auth.js", text: INVALIDATED_FACT },
      },
    ],
    { reason: "seed canonical facts", sourceRefs: ["src/server.js"] },
  );
  const seedCheck = await validateDelta(root, seeded.id);
  assert.equal(seedCheck.ok, true, `seed proposal rejected: ${seedCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, seeded.id, { decision: "seed" })).ok, true);

  const invalidation = await proposeDelta(
    root,
    [{ op: "invalidate", entryId: "fact-auth-old" }],
    { reason: "auth header replaced", sourceRefs: ["src/auth.js"] },
  );
  const invalidationCheck = await validateDelta(root, invalidation.id);
  assert.equal(invalidationCheck.ok, true, `invalidation rejected: ${invalidationCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, invalidation.id, { decision: "replaced" })).ok, true);
}

function taskStateFor() {
  const state = createState(TASK_ID);
  return {
    ...state,
    parentId: GROUP_ID,
    nextAction: "resolve the rate-limit conflict",
    contract: {
      status: "APPROVED",
      objective: "Ship session tokens without breaking tenancy",
      constraints: ["no new runtime dependencies", "keep latency below 50ms"],
      nonGoals: ["redesign the whole auth stack"],
      unknowns: [{ id: "unk-1", status: "blocking", question: "Is SSO in scope?" }],
    },
    requirements: [
      { id: "req-verified-1", title: "Session token issuance", status: "verified" },
      { id: "req-pending-2", title: "Tenant rate limiting", status: "in_progress" },
    ],
  };
}

const decisions = [
  {
    id: "dec-sqlite",
    status: "accepted",
    text: `Use SQLite — reason: ${LIVE_REASON}`,
    reason: LIVE_REASON,
  },
  { id: "dec-json", status: "superseded", text: SUPERSEDED_DECISION, supersededBy: "dec-sqlite" },
  { id: "dec-redis", status: "rejected", text: "Adopt Redis for sessions", reason: "extra infra" },
];

function continuityProbes(text) {
  const checks = [
    ["verified requirement id", text.includes("req-verified-1")],
    ["pending obligation id", text.includes("req-pending-2")],
    ["superseded decision absent", !text.includes(SUPERSEDED_DECISION)],
    ["live decision reason", text.includes(LIVE_REASON)],
    ["evidence ref", text.includes("evidence-tests-1")],
    ["sibling secret absent", !text.includes(SIBLING_SECRET)],
    ["invalidated fact not current", !text.includes(INVALIDATED_FACT)],
    ["retrievable ref", text.includes("fact-api-v2")],
  ];
  return { checks, score: checks.filter(([, ok]) => ok).length };
}

async function buildFixture(root) {
  const ev = eventFactory();
  seedLedger(root, TASK_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-verified-1", { claim: "POST /sessions returns a signed token" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-verified-1", { summary: "added the handler" }),
    ev(WAM_EVENTS.OBSERVATION_CREATED, "req-verified-1", { summary: "201 returned with a token" }),
    ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", {
      ref: "evidence-tests-1",
      note: "integration test passed",
    }),
    ev(WAM_EVENTS.VERIFICATION_STARTED, "req-verified-1", { note: "ran the test suite" }),
    ev(WAM_EVENTS.VERIFICATION_COMPLETED, "req-verified-1", { status: "VERIFIED" }),
    ev(WAM_EVENTS.CLAIM_CREATED, "req-pending-2", { claim: "Rate limit per tenant is enforced" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-pending-2", { summary: "drafted the limiter" }),
    ev(WAM_EVENTS.EVIDENCE_CONFLICT, "req-pending-2", {
      ref: "evidence-conflict-1",
      note: "two limits disagree",
    }),
  ]);
  saveTask(TASK_ID, taskStateFor(), root);

  seedLedger(root, SIBLING_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-sib-1", { claim: `Sibling only: ${SIBLING_SECRET}` }),
  ]);
  saveTask(
    SIBLING_ID,
    {
      ...createState(SIBLING_ID),
      contract: { status: "DRAFT", objective: `Sibling work ${SIBLING_SECRET}`, requirements: [] },
    },
    root,
  );

  saveTask(
    GROUP_ID,
    { ...createState(GROUP_ID), scope: "group", kind: "group", contract: { status: "DRAFT", objective: "Group work", requirements: [] } },
    root,
  );

  await seedBase(root);

  const items = [
    { id: "evidence-archived-1", kind: "EVIDENCE", retention: "archivable", text: "old transcript" },
    { id: "req-verified-1", kind: "REQUIREMENT", status: "verified" },
  ];
  const plan = planRetention(items);
  const archived = applyRetentionPlan(items, plan).archived;
  assert.deepEqual(plan.archive, ["evidence-archived-1"]);

  const storedDetail = new Map([
    [
      "evidence-archived-1",
      "Archived transcript: 12 assertions covering issuance, refresh and revocation.",
    ],
    ["fact-api-v2", "Canonical fact: the public API base URL is /v2; /v1 is deprecated."],
  ]);
  return { archived, storedDetail };
}

function measure(name, brief, recoveryRefs, storedDetail) {
  const { checks, score } = continuityProbes(brief.text);
  const recoveryTokens = recoveryRefs.reduce(
    (sum, ref) => sum + tokens(storedDetail.get(ref) || ""),
    0,
  );
  return {
    name,
    checks,
    score,
    briefTokens: brief.tokens,
    recoveryTokens,
    totalTokens: brief.tokens + recoveryTokens,
  };
}

function printTable(rows) {
  console.log("system        continuity  briefTokens  recoveryTokens  totalTokens");
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(12)}  ${`${row.score}/8`.padEnd(10)}  ${String(row.briefTokens).padEnd(11)}  ${String(row.recoveryTokens).padEnd(14)}  ${row.totalTokens}`,
    );
  }
}

test("semantic continuity benchmark", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-semantic-continuity-"));
  try {
    const { storedDetail } = await buildFixture(root);
    const taskState = loadTask(TASK_ID, root);
    const base = await loadBase(root);

    const baselineBrief = buildContextBrief({ taskId: TASK_ID, taskState, decisions });
    const projectionBrief = buildContextBrief({ taskId: TASK_ID, taskState, decisions, root, base });

    const recoveryRefs = ["evidence-archived-1", "fact-api-v2"];
    const baseline = measure("baseline", baselineBrief, recoveryRefs, storedDetail);
    const projection = measure("projection", projectionBrief, recoveryRefs, storedDetail);
    printTable([baseline, projection]);

    await t.test("projection scores 8/8 and beats the legacy brief", () => {
      assert.deepEqual(
        projection.checks.filter(([, ok]) => !ok),
        [],
      );
      assert.equal(projection.score, 8);
      assert.ok(
        projection.score > baseline.score,
        `projection ${projection.score}/8 vs baseline ${baseline.score}/8`,
      );
    });

    await t.test("total tokens stay within the 4000-char budget", () => {
      assert.ok(projection.totalTokens <= BUDGET_TOKENS, `total ${projection.totalTokens} tokens`);
      assert.ok(projectionBrief.text.length <= BUDGET_CHARS, `brief ${projectionBrief.text.length} chars`);
    });

    await t.test("both systems are deterministic", () => {
      const again = buildContextBrief({ taskId: TASK_ID, taskState, decisions, root, base });
      assert.equal(again.text, projectionBrief.text);
      const legacyAgain = buildContextBrief({ taskId: TASK_ID, taskState, decisions });
      assert.equal(legacyAgain.text, baselineBrief.text);
    });

    await t.test("restart reloads state from disk without carryover", async () => {
      const restarted = buildContextBrief({
        taskId: TASK_ID,
        taskState: loadTask(TASK_ID, root),
        decisions,
        root,
        ledger: loadExecutionLedger(root, TASK_ID),
        base: await loadBase(root),
      });
      assert.equal(restarted.text, projectionBrief.text);
    });

    await t.test("task projections stay isolated", () => {
      const siblingBrief = buildContextBrief({
        taskId: SIBLING_ID,
        taskState: loadTask(SIBLING_ID, root),
        decisions: [],
        root,
      });
      assert.ok(!siblingBrief.text.includes("req-verified-1"));
      assert.ok(!siblingBrief.text.includes("req-pending-2"));
      assert.ok(!projectionBrief.text.includes("req-sib-1"));
      assert.ok(!projectionBrief.text.includes(SIBLING_SECRET));
    });

    await t.test("consolidation surfaces the summary in the group projection", () => {
      const consolidation = consolidateTaskToGroup(root, TASK_ID);
      assert.equal(consolidation.ok, true, consolidation.errors?.join("; "));
      const groupState = loadTask(GROUP_ID, root);
      const entry = groupState.consolidated.find((item) => item.taskId === TASK_ID);
      assert.ok(entry, "consolidated entry missing");
      assert.equal(entry.requirementsDone, 1);

      const summary = `consolidated ${entry.taskId}: ${entry.requirementsDone} verified`;
      const groupBrief = buildContextBrief({
        taskId: GROUP_ID,
        taskState: { ...groupState, contract: { ...groupState.contract, objective: summary } },
      });
      assert.ok(groupBrief.text.includes(summary));

      const siblingState = loadTask(SIBLING_ID, root);
      assert.equal(siblingState.consolidated, undefined);
      const siblingBrief = buildContextBrief({ taskId: SIBLING_ID, taskState: siblingState });
      assert.ok(!siblingBrief.text.includes(summary));
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
