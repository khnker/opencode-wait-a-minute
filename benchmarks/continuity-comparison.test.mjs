/**
 * Comparative continuity benchmark: full context vs status-blind top-k vs WAM.
 *
 * Deterministic simulation over the real ledger/base/decision modules; no model
 * calls. "Task success" here means "the information required for the task
 * survives selection" — model comprehension is deferred to shadow mode.
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
  projectExecution,
  saveExecutionLedger,
} from "../src/state/execution-ledger.js";
import { acceptDelta, loadBase, proposeDelta, validateDelta } from "../src/context/canonical-deltas.js";
import { createState } from "../src/state/task-state.js";
import { loadTask, saveTask } from "../src/state/task-store.js";
import { getApplicableConstraints } from "../src/state/task-hierarchy.js";
import { WAM_EVENTS } from "../src/shared/wam-events.js";

const PROJECT_ID = "project-payments";
const GROUP_ID = "group-checkout";
const TASK_ID = "task-continuity";
const SIBLING_ID = "task-sibling";

const BUDGET_CHARS = 4000;
const TOP_K = 8;
const START = 1_700_000_000_000;

const PROJECT_CONSTRAINT = "no breaking API changes for partner integrations";
const GROUP_CONSTRAINT = "all card data stays on-device";
const TASK_CONSTRAINT = "keep latency below 50ms";

const LIVE_REASON = "survives restarts";
const LIVE_DECISION = `Use SQLite — reason: ${LIVE_REASON}`;
const SUPERSEDED_DECISION = "Store session tokens in JSON files";
const HYPOTHESIS = "Session tokens might live in httpOnly cookies";
const INVALIDATED_FACT = "Legacy auth header X-Old-Token is current";
const ACTIVE_FACT = "API base path is /v2 for all session calls";
const DEP_FACT_ID = "fact-payments-client";
const DEP_FILE = "src/deps/payments-client.js";
const DEP_FACT = "Payments client wrapper lives in the dependency file";
const SIBLING_SECRET = "zebra-salt-42";

const DECISIONS = [
  { id: "dec-sqlite", status: "accepted", text: LIVE_DECISION, reason: LIVE_REASON },
  { id: "dec-json", status: "superseded", text: SUPERSEDED_DECISION, supersededBy: "dec-sqlite" },
  { id: "dec-redis", status: "rejected", text: "Adopt Redis for sessions", reason: "extra infra" },
];

// Large-state fixture: critical items are inserted after bulk filler so the
// status-blind `full` dump truncates before reaching them.
const LARGE_FILLER_TEXT = "Rollout bookkeeping for the legacy worker pool remains consistent across every region";
const LARGE_REQUIREMENTS = Array.from({ length: 58 }, (_, index) => ({
  id: `req-bulk-${String(index + 1).padStart(3, "0")}`,
  title: `Requirement ${index + 1}: ${LARGE_FILLER_TEXT}`,
  status: "verified",
}));
const LARGE_DECISIONS = [
  ...Array.from({ length: 36 }, (_, index) => ({
    id: `dec-bulk-${index + 1}`,
    status: "accepted",
    text: `Adopt deterministic retry policy variant ${index + 1} for the payments worker pool`,
  })),
  { id: "dec-sqlite", status: "accepted", text: LIVE_DECISION, reason: LIVE_REASON },
  { id: "dec-json", status: "superseded", text: SUPERSEDED_DECISION, supersededBy: "dec-sqlite" },
  { id: "dec-files", status: "superseded", text: "Persist refresh tokens in config files", supersededBy: "dec-sqlite" },
  { id: "dec-redis", status: "rejected", text: "Adopt Redis for sessions", reason: "extra infra" },
];
const LARGE_FACTS = Array.from({ length: 37 }, (_, index) => ({
  id: `fact-z-${String(index + 1).padStart(3, "0")}`,
  kind: "fact",
  section: "bulk",
  source: `src/bulk/${index + 1}.js`,
  text: `Operational note ${index + 1}: ${LARGE_FILLER_TEXT} in scope ${index + 1}`,
}));

const STOP_WORDS = new Set([
  "with", "without", "from", "that", "this", "they", "have", "into", "over",
  "than", "then", "when", "will", "for", "the", "and", "all",
]);

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

async function seedFixture(root) {
  const ev = eventFactory();
  seedLedger(root, TASK_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-verified-1", { claim: "POST /sessions returns a signed token" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-verified-1", { summary: "added the handler" }),
    ev(WAM_EVENTS.OBSERVATION_CREATED, "req-verified-1", { summary: "201 returned with a token" }),
    ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", { ref: "evidence-tests-1", note: "integration test passed" }),
    ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", { ref: DEP_FILE, note: "dependency wrapper" }),
    ev(WAM_EVENTS.VERIFICATION_STARTED, "req-verified-1", { note: "ran the test suite" }),
    ev(WAM_EVENTS.VERIFICATION_COMPLETED, "req-verified-1", { status: "VERIFIED" }),
    ev(WAM_EVENTS.CLAIM_CREATED, "req-pending-2", { claim: "Rate limit per tenant is enforced" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-pending-2", { summary: "drafted the limiter" }),
    ev(WAM_EVENTS.EVIDENCE_CONFLICT, "req-pending-2", { ref: "evidence-conflict-1", note: "two limits disagree" }),
  ]);

  seedLedger(root, SIBLING_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-sib-1", { claim: `Sibling only: ${SIBLING_SECRET}` }),
  ]);

  saveTask(PROJECT_ID, {
    ...createState(PROJECT_ID),
    scope: "project",
    kind: "project",
    constraints: [PROJECT_CONSTRAINT],
    contract: { status: "APPROVED", objective: "Payments platform", requirements: [] },
  }, root);

  saveTask(GROUP_ID, {
    ...createState(GROUP_ID),
    scope: "group",
    kind: "group",
    parentId: PROJECT_ID,
    constraints: [GROUP_CONSTRAINT],
    contract: { status: "APPROVED", objective: "Checkout group", requirements: [] },
  }, root);

  saveTask(TASK_ID, {
    ...createState(TASK_ID),
    scope: "task",
    kind: "task",
    parentId: GROUP_ID,
    nextAction: "resolve the rate-limit conflict",
    contract: {
      status: "APPROVED",
      objective: "Ship session tokens without breaking the API for tenancy",
      constraints: [TASK_CONSTRAINT],
      nonGoals: ["redesign the whole auth stack"],
      unknowns: [{ id: "unk-hypothesis", status: "open", question: HYPOTHESIS }],
    },
    requirements: [
      { id: "req-verified-1", title: "Session token issuance", status: "verified" },
      { id: "req-pending-2", title: "Tenant rate limiting", status: "in_progress" },
    ],
  }, root);

  saveTask(SIBLING_ID, {
    ...createState(SIBLING_ID),
    scope: "task",
    kind: "task",
    parentId: GROUP_ID,
    contract: { status: "DRAFT", objective: `Sibling work ${SIBLING_SECRET}`, requirements: [] },
  }, root);

  const seeded = await proposeDelta(root, [
    { op: "add", entry: { id: DEP_FACT_ID, kind: "fact", section: "deps", source: DEP_FILE, text: DEP_FACT } },
    { op: "add", entry: { id: "fact-api-v2", kind: "fact", section: "api", source: "src/server.js", text: ACTIVE_FACT } },
    { op: "add", entry: { id: "fact-auth-old", kind: "fact", section: "auth", source: "src/auth/legacy.js", text: INVALIDATED_FACT } },
  ], { reason: "seed canonical facts", sourceRefs: [DEP_FILE] });
  const seedCheck = await validateDelta(root, seeded.id);
  assert.equal(seedCheck.ok, true, `seed proposal rejected: ${seedCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, seeded.id, { decision: "seed" })).ok, true);

  const invalidation = await proposeDelta(root, [{ op: "invalidate", entryId: "fact-auth-old" }], {
    reason: "auth header replaced",
    sourceRefs: ["src/auth/legacy.js"],
  });
  const invalidationCheck = await validateDelta(root, invalidation.id);
  assert.equal(invalidationCheck.ok, true, `invalidation rejected: ${invalidationCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, invalidation.id, { decision: "replaced" })).ok, true);
}

async function seedLargeFixture(root) {
  const ev = eventFactory();
  const ledger = seedLedger(root, TASK_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-verified-1", { claim: "POST /sessions returns a signed token" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-verified-1", { summary: "added the handler" }),
    ev(WAM_EVENTS.OBSERVATION_CREATED, "req-verified-1", { summary: "201 returned with a token" }),
    ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", { ref: "evidence-tests-1", note: "integration test passed" }),
    ev(WAM_EVENTS.EVIDENCE_ADDED, "req-verified-1", { ref: DEP_FILE, note: "dependency wrapper" }),
    ev(WAM_EVENTS.VERIFICATION_STARTED, "req-verified-1", { note: "ran the test suite" }),
    ev(WAM_EVENTS.VERIFICATION_COMPLETED, "req-verified-1", { status: "VERIFIED" }),
    ev(WAM_EVENTS.CLAIM_CREATED, "req-pending-2", { claim: "Rate limit per tenant is enforced" }),
    ev(WAM_EVENTS.ACTION_STARTED, "req-pending-2", { summary: "drafted the limiter" }),
  ]);

  // 60 extra ledger requirements; filler ids sort first so a flat cap drops the critical ones.
  const largeRequirement = (id, overrides) => ({
    id,
    claim: `Bulk requirement ${id}`,
    status: "VERIFIED",
    evidence: [],
    decisions: [],
    obligations: [],
    actions: [],
    observations: [],
    createdAt: START,
    ...overrides,
  });
  for (let index = 0; index < 60; index += 1) {
    const id = `req-bulk-${String(index + 1).padStart(3, "0")}`;
    ledger.requirements[id] = largeRequirement(id);
  }
  ledger.requirements["req-z-critical-pending"] = largeRequirement("req-z-critical-pending", {
    claim: "Tenant limit must survive compaction",
    status: "IN_PROGRESS",
  });
  ledger.requirements["req-z-critical-evidence"] = largeRequirement("req-z-critical-evidence", {
    claim: "Evidence-bearing critical requirement",
    evidence: [{ eventId: "evt-critical", at: START, ref: "evidence-critical-1", kind: "support", note: "probe evidence" }],
  });
  ledger.requirements["req-z-critical-failed"] = largeRequirement("req-z-critical-failed", {
    claim: "Invalidated-adjacent critical requirement",
    status: "FAILED",
  });
  saveExecutionLedger(root, ledger);

  seedLedger(root, SIBLING_ID, [
    ev(WAM_EVENTS.CLAIM_CREATED, "req-sib-1", { claim: `Sibling only: ${SIBLING_SECRET}` }),
  ]);

  saveTask(PROJECT_ID, {
    ...createState(PROJECT_ID),
    scope: "project",
    kind: "project",
    constraints: [PROJECT_CONSTRAINT],
    contract: { status: "APPROVED", objective: "Payments platform", requirements: [] },
  }, root);

  saveTask(GROUP_ID, {
    ...createState(GROUP_ID),
    scope: "group",
    kind: "group",
    parentId: PROJECT_ID,
    constraints: [GROUP_CONSTRAINT],
    contract: { status: "APPROVED", objective: "Checkout group", requirements: [] },
  }, root);

  saveTask(TASK_ID, {
    ...createState(TASK_ID),
    scope: "task",
    kind: "task",
    parentId: GROUP_ID,
    nextAction: "resolve the rate-limit conflict",
    contract: {
      status: "APPROVED",
      objective: "Ship session tokens without breaking the API for tenancy",
      constraints: [TASK_CONSTRAINT],
      nonGoals: ["redesign the whole auth stack"],
      unknowns: [{ id: "unk-hypothesis", status: "open", question: HYPOTHESIS }],
    },
    requirements: [
      ...LARGE_REQUIREMENTS,
      { id: "req-verified-1", title: "Session token issuance", status: "verified" },
      { id: "req-pending-2", title: "Tenant rate limiting", status: "in_progress" },
    ],
  }, root);

  saveTask(SIBLING_ID, {
    ...createState(SIBLING_ID),
    scope: "task",
    kind: "task",
    parentId: GROUP_ID,
    contract: { status: "DRAFT", objective: `Sibling work ${SIBLING_SECRET}`, requirements: [] },
  }, root);

  const seeded = await proposeDelta(root, [
    ...LARGE_FACTS.map((entry) => ({ op: "add", entry })),
    { op: "add", entry: { id: DEP_FACT_ID, kind: "fact", section: "deps", source: DEP_FILE, text: DEP_FACT } },
    { op: "add", entry: { id: "fact-api-v2", kind: "fact", section: "api", source: "src/server.js", text: ACTIVE_FACT } },
    { op: "add", entry: { id: "fact-auth-old", kind: "fact", section: "auth", source: "src/auth/legacy.js", text: INVALIDATED_FACT } },
  ], { reason: "seed large canonical state", sourceRefs: [DEP_FILE] });
  const seedCheck = await validateDelta(root, seeded.id);
  assert.equal(seedCheck.ok, true, `large seed rejected: ${seedCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, seeded.id, { decision: "seed" })).ok, true);

  const invalidation = await proposeDelta(root, [{ op: "invalidate", entryId: "fact-auth-old" }], {
    reason: "auth header replaced",
    sourceRefs: ["src/auth/legacy.js"],
  });
  const invalidationCheck = await validateDelta(root, invalidation.id);
  assert.equal(invalidationCheck.ok, true, `large invalidation rejected: ${invalidationCheck.errors?.join("; ")}`);
  assert.equal((await acceptDelta(root, invalidation.id, { decision: "replaced" })).ok, true);
}

function collectItems({ state, ledger, base, applicableConstraints, decisions = DECISIONS, statusFirst = false }) {
  const exec = projectExecution(ledger);
  const items = [];
  const push = (kind, text, meta = {}) => items.push({ kind, text, ...meta });

  const pushTaskState = () => {
    for (const req of state.requirements || []) push("requirement", `${req.id}: ${req.title}`);
    for (const req of exec.requirements) {
      for (const ref of req.evidenceRefs) push("evidence", `${req.id} evidence: ${ref}`);
    }
    for (const item of exec.pendingObligations) {
      push("obligation", `${item.requirementId} pending: ${item.reason} (${item.status})`);
    }
  };
  const pushStatusState = () => {
    for (const item of exec.conflicts) {
      push("conflict", `${item.requirementId} conflict: ${item.ref}: ${item.note || "unresolved"}`);
    }
    for (const constraint of applicableConstraints) push("constraint", `constraint: ${constraint}`, { mandatory: true });
    for (const constraint of state.contract?.constraints || []) push("constraint", `constraint: ${constraint}`);
    for (const decision of decisions) push("decision", decision.text);
    for (const unknown of state.contract?.unknowns || []) push("unknown", unknown.question || unknown.text || "");
    for (const entry of base?.entries || []) push("fact", `${entry.text} [source: ${entry.source}]`);
  };

  if (statusFirst) {
    pushStatusState();
    pushTaskState();
  } else {
    pushTaskState();
    pushStatusState();
  }
  return items;
}

function termSet(text) {
  const matches = String(text || "").toLowerCase().match(/[a-z0-9-]+/g) || [];
  return new Set(matches.filter((term) => term.length >= 4 && !STOP_WORDS.has(term)));
}

function renderFull(items, maxChars = BUDGET_CHARS) {
  return items.map((item) => `- ${item.text}`).join("\n").slice(0, maxChars);
}

function renderTopK(items, query, maxChars = BUDGET_CHARS) {
  const queryTerms = termSet(query);
  const selected = items
    .map((item, index) => {
      const terms = termSet(item.text);
      let score = 0;
      for (const term of queryTerms) if (terms.has(term)) score += 1;
      return { item, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, TOP_K)
    .sort((a, b) => a.index - b.index);
  return selected.map(({ item }) => `- ${item.text}`).join("\n").slice(0, maxChars);
}

function renderWam({ state, base, root, decisions = DECISIONS, maxChars = BUDGET_CHARS }) {
  return buildContextBrief({
    taskId: TASK_ID,
    taskState: state,
    decisions,
    entities: [],
    root,
    base,
    maxChars,
  }).text;
}

function presentsAsFact(text, phrase) {
  return text
    .split("\n")
    .some((line) => line.includes(phrase) && !/unknown|open|uncertain|hypothesis|retrievable/i.test(line));
}

// Probe order is shared by every strategy; status-aware probes are 5, 6 and 7.
const PROBES = [
  ["verified requirement id", (text) => text.includes("req-verified-1")],
  ["pending obligation id", (text) => text.includes("req-pending-2")],
  [
    "mandatory ancestor constraints",
    (text) => text.includes(PROJECT_CONSTRAINT) && text.includes(GROUP_CONSTRAINT),
  ],
  ["evidence ref for verified", (text) => text.includes("evidence-tests-1")],
  ["superseded decision absent", (text) => !text.includes(SUPERSEDED_DECISION)],
  ["hypothesis not presented as fact", (text) => !presentsAsFact(text, HYPOTHESIS)],
  ["invalidated fact not current", (text) => !text.includes(INVALIDATED_FACT)],
  ["sibling secret absent", (text) => !text.includes(SIBLING_SECRET)],
  ["dependency file ref recoverable", (text) => text.includes(DEP_FILE) || text.includes(DEP_FACT_ID)],
  ["restart deterministic", (text, restart) => text === restart],
];

const STATUS_AWARE = [4, 5, 6];

function measure(name, text, restartText, detail, recoveryRefs, selectMs) {
  const checks = PROBES.map(([label, fn]) => [label, Boolean(fn(text, restartText))]);
  const recoveryTokens = recoveryRefs.reduce((sum, ref) => sum + tokens(detail.get(ref) || ""), 0);
  const briefTokens = tokens(text);
  return {
    name,
    text,
    checks,
    continuity: checks.filter(([, ok]) => ok).length,
    mandatoryLost: [PROJECT_CONSTRAINT, GROUP_CONSTRAINT].filter((constraint) => !text.includes(constraint)).length,
    briefTokens,
    recoveryTokens,
    totalTokens: briefTokens + recoveryTokens,
    selectMs,
  };
}

function timeMs(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

function printTable(rows) {
  const header = "strategy | continuity | mandatoryLost | briefTokens | recoveryTokens | totalTokens | selectMs";
  console.log(header);
  for (const row of rows) {
    console.log(
      [
        row.name.padEnd(8),
        `${row.continuity}/10`.padEnd(10),
        String(row.mandatoryLost).padEnd(13),
        String(row.briefTokens).padEnd(11),
        String(row.recoveryTokens).padEnd(14),
        String(row.totalTokens).padEnd(11),
        row.selectMs.toFixed(2),
      ].join(" | "),
    );
  }
}

async function loadScenario(root) {
  return {
    state: loadTask(TASK_ID, root),
    ledger: loadExecutionLedger(root, TASK_ID),
    base: await loadBase(root),
    applicableConstraints: getApplicableConstraints(root, TASK_ID),
  };
}

async function evaluate(root, { decisions = DECISIONS, statusFirst = false } = {}) {
  const storedDetail = new Map([[DEP_FACT_ID, `${DEP_FACT} [source: ${DEP_FILE}]`]]);
  const first = await loadScenario(root);
  const items = collectItems({ ...first, decisions, statusFirst });
  const query = [first.state.contract.objective, ...first.applicableConstraints].join(" ");

  const fullRun = timeMs(() => renderFull(items));
  const topkRun = timeMs(() => renderTopK(items, query));
  const wamRun = timeMs(() => renderWam({ state: first.state, base: first.base, root, decisions }));

  const second = await loadScenario(root);
  const restartItems = collectItems({ ...second, decisions, statusFirst });
  const fullRestart = renderFull(restartItems);
  const topkRestart = renderTopK(restartItems, [second.state.contract.objective, ...second.applicableConstraints].join(" "));
  const wamRestart = renderWam({ state: second.state, base: second.base, root, decisions });

  const rows = [
    measure("full", fullRun.value, fullRestart, storedDetail, [], fullRun.ms),
    measure("top-k", topkRun.value, topkRestart, storedDetail, [], topkRun.ms),
    measure("wam", wamRun.value, wamRestart, storedDetail, wamRun.value.includes(DEP_FACT_ID) ? [DEP_FACT_ID] : [], wamRun.ms),
  ];
  return { rows, rawFullChars: items.map((item) => `- ${item.text}`).join("\n").length };
}

test("continuity comparison benchmark", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-continuity-comparison-"));
  try {
    await seedFixture(root);
    const { rows } = await evaluate(root);
    const [full, topk, wam] = rows;

    printTable(rows);

    await t.test("WAM preserves all ten probes with zero mandatory loss", () => {
      const failed = wam.checks.filter(([, ok]) => !ok).map(([label]) => label);
      assert.equal(wam.continuity, 10, `wam probes failed: ${failed.join(", ")}`);
      assert.equal(wam.mandatoryLost, 0);
    });

    await t.test("WAM is a strict superset of both naive strategies on status-aware probes", () => {
      for (const index of STATUS_AWARE) assert.ok(wam.checks[index][1], `wam failed: ${PROBES[index][0]}`);
      for (const other of [topk, full]) {
        for (const index of STATUS_AWARE) {
          if (other.checks[index][1]) assert.ok(wam.checks[index][1], `wam must also pass: ${PROBES[index][0]}`);
        }
      }
    });

    await t.test("each naive strategy fails at least one deliberate failure case", () => {
      const topkFailures = STATUS_AWARE.filter((index) => !topk.checks[index][1]);
      const fullFailures = STATUS_AWARE.filter((index) => !full.checks[index][1]);
      assert.ok(topkFailures.length >= 1, "top-k passed every status-aware probe");
      assert.ok(fullFailures.length >= 1, "full passed every status-aware probe");
      assert.ok(topkFailures.length < 3 || fullFailures.length < 3, "WAM has no discriminating advantage");
    });

    await t.test("every strategy stays inside the shared character budget", () => {
      for (const row of rows) assert.ok(row.text.length <= BUDGET_CHARS, `${row.name} ${row.text.length} chars`);
    });

    await t.test("total tokens are brief plus recovered detail", () => {
      for (const row of rows) assert.equal(row.totalTokens, row.briefTokens + row.recoveryTokens);
      assert.ok(wam.recoveryTokens > 0, "wam should recover its referenced detail");
    });

    await t.test("restart reloads from disk without divergence", () => {
      for (const row of rows) assert.ok(row.checks[9][1], `${row.name} restart diverged`);
    });

    await t.test("large-state scenario", async (t2) => {
      const largeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wam-continuity-large-"));
      try {
        await seedLargeFixture(largeRoot);
        const { rows: largeRows, rawFullChars } = await evaluate(largeRoot, {
          decisions: LARGE_DECISIONS,
          statusFirst: true,
        });
        const [fullLarge, topkLarge, wamLarge] = largeRows;
        console.log("scenario: large-state");
        printTable(largeRows);

        await t2.test("full exceeds the raw budget and truncates", () => {
          assert.ok(rawFullChars > BUDGET_CHARS, `full raw ${rawFullChars} chars`);
          assert.ok(fullLarge.text.length <= BUDGET_CHARS, `full rendered ${fullLarge.text.length} chars`);
          assert.equal(fullLarge.text.length, BUDGET_CHARS, "full did not truncate at the budget");
        });

        await t2.test("WAM stays within budget with all ten probes", () => {
          assert.ok(wamLarge.text.length <= BUDGET_CHARS, `wam ${wamLarge.text.length} chars`);
          const failed = wamLarge.checks.filter(([, ok]) => !ok).map(([label]) => label);
          assert.equal(wamLarge.continuity, 10, `wam probes failed: ${failed.join(", ")}`);
          assert.equal(wamLarge.mandatoryLost, 0);
        });

        await t2.test("priority selection keeps critical requirements at scale", () => {
          for (const id of [
            "req-pending-2",
            "req-z-critical-pending",
            "req-z-critical-evidence",
            "req-z-critical-failed",
          ]) {
            assert.ok(wamLarge.text.includes(id), `dropped critical requirement ${id}`);
          }
        });

        await t2.test("full loses the pending requirement and a status-aware probe", () => {
          assert.ok(fullLarge.continuity < wamLarge.continuity, `full ${fullLarge.continuity}/10 vs wam ${wamLarge.continuity}/10`);
          assert.equal(fullLarge.checks[1][1], false, "full kept the pending requirement");
          const statusFailures = STATUS_AWARE.filter((index) => !fullLarge.checks[index][1]);
          assert.ok(statusFailures.length >= 1, "full passed every status-aware probe");
        });

        await t2.test("top-k remains status-blind at scale", () => {
          const statusFailures = STATUS_AWARE.filter((index) => !topkLarge.checks[index][1]);
          assert.ok(statusFailures.length >= 1, "top-k passed every status-aware probe");
        });

        await t2.test("large-state restart is deterministic", () => {
          for (const row of largeRows) assert.ok(row.checks[9][1], `${row.name} restart diverged`);
        });
      } finally {
        fs.rmSync(largeRoot, { recursive: true, force: true });
      }
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
