import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSemanticProjection, renderSemanticProjection } from "./semantic-projection.js";

const truncate = (text, max = 160) => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
};

const baseTask = {
  phase: "IMPLEMENTING",
  contract: {
    objective: "Project structured state",
    constraints: ["no new dependencies"],
    unknowns: [{ id: "u1", question: "Which cap?", status: "blocking" }],
  },
  evidence: [{ id: "ev-state", path: "src/context/context-brief.js" }],
};

const ledger = {
  taskId: "t1",
  requirements: {
    "req-b": {
      id: "req-b",
      claim: "second",
      status: "VERIFIED",
      evidence: [{ ref: "ev-2", kind: "support" }],
    },
    "req-a": {
      id: "req-a",
      claim: "first",
      status: "PENDING",
      evidence: [{ ref: "ev-1", kind: "support" }],
    },
    "req-c": {
      id: "req-c",
      claim: "third",
      status: "SUPPORTED",
      evidence: [{ ref: "ev-3", kind: "conflict", note: "differs from ev-9" }],
    },
  },
};

test("keeps only live decisions linked to the task", () => {
  const decisions = [
    { id: "task-t1-d1", status: "accepted", decision: "use projection" },
    { id: "task-t1-d2", status: "rejected", decision: "keep transcript summary" },
    { id: "task-t1-d3", status: "superseded", decision: "old approach" },
    { id: "task-t1-d4", status: "approved", decision: "ship it" },
    { id: "task-t1-d5", status: "proposed", decision: "maybe later" },
    { id: "task-t1-d6", status: "invalidated", decision: "invalid" },
  ];

  const projection = buildSemanticProjection({ taskId: "task-t1", taskState: baseTask, decisions });

  assert.deepEqual(projection.decisions.map((d) => d.id), ["task-t1-d1", "task-t1-d4"]);
});

test("drops decisions from other tasks and sessions", () => {
  const decisions = [
    { id: "strategy-ses-other-1788489794148", status: "approved", decision: "Aprobar estrategia NORMAL" },
    { id: "task-t1-decision-1788604421557", status: "accepted", decision: "use projection" },
    { id: "strategy-ses-other2-1788604421999", status: "accepted", decision: "unrelated" },
  ];

  const projection = buildSemanticProjection({ taskId: "task-t1", taskState: baseTask, decisions });

  assert.deepEqual(projection.decisions.map((d) => d.id), ["task-t1-decision-1788604421557"]);
});

test("keeps project-wide decisions without a scope marker", () => {
  const decisions = [
    { id: "dec-sqlite", status: "accepted", decision: "use sqlite" },
    { id: "strategy-ses-other-1788489794148", status: "accepted", decision: "other session" },
  ];

  const projection = buildSemanticProjection({ taskId: "task-t1", taskState: baseTask, decisions });

  assert.deepEqual(projection.decisions.map((d) => d.id), ["dec-sqlite"]);
});

test("collapses repeated decisions, keeping the most recent", () => {
  const decisions = [
    { id: "task-t1-a-1700000000000", status: "accepted", decision: "Aprobar estrategia FAST" },
    { id: "task-t1-b-1800000000000", status: "accepted", decision: "Aprobar estrategia FAST" },
    { id: "task-t1-c-1750000000000", status: "accepted", decision: "Aprobar estrategia NORMAL" },
  ];

  const projection = buildSemanticProjection({ taskId: "task-t1", taskState: baseTask, decisions });

  assert.deepEqual(projection.decisions.map((d) => d.id), [
    "task-t1-b-1800000000000",
    "task-t1-c-1750000000000",
  ]);
});

test("orders task decisions most recent first", () => {
  const decisions = [
    { id: "task-t1-old-1700000000000", status: "accepted", decision: "first" },
    { id: "task-t1-new-1800000000000", status: "accepted", decision: "second" },
  ];

  const projection = buildSemanticProjection({ taskId: "task-t1", taskState: baseTask, decisions });

  assert.deepEqual(projection.decisions.map((d) => d.id), [
    "task-t1-new-1800000000000",
    "task-t1-old-1700000000000",
  ]);
});

test("surfaces pending obligations and evidence conflicts", () => {
  const projection = buildSemanticProjection({ taskId: "t1", taskState: baseTask, ledger });

  assert.deepEqual(projection.execution.requirements.map((r) => r.id), ["req-a", "req-b", "req-c"]);
  assert.ok(projection.execution.pending.some((item) => item.requirementId === "req-a"));
  assert.deepEqual(projection.execution.conflicts, [
    { requirementId: "req-c", ref: "ev-3", note: "differs from ev-9" },
  ]);
  assert.match(projection.nextObligation, /^req-a: /);
  assert.ok(projection.openItems.some((item) => item.kind === "conflict" && item.ref === "req-c"));
  assert.ok(projection.openItems.some((item) => item.kind === "obligation" && item.ref === "req-a"));
  assert.ok(projection.openItems.some((item) => item.kind === "unknown" && item.ref === "u1"));
});

test("renders evidence as compact refs only", () => {
  const projection = buildSemanticProjection({ taskId: "t1", taskState: baseTask, ledger });

  assert.deepEqual(projection.evidenceRefs, ["ev-1", "ev-2", "ev-3", "ev-state"]);
  assert.ok(projection.evidenceRefs.every((ref) => typeof ref === "string" && !ref.includes(" ")));
});

test("is deterministic across builds and renders", () => {
  const args = {
    taskId: "t1",
    taskState: baseTask,
    decisions: [{ id: "task-t1-d1", status: "accepted", decision: "use projection" }],
    ledger,
    base: { entries: [{ id: "cpc-2", status: "active" }, { id: "cpc-1", status: "superseded" }] },
    constraints: ["no new dependencies"],
  };

  const first = buildSemanticProjection(args);
  const second = buildSemanticProjection(args);
  assert.deepEqual(first, second);
  assert.equal(
    renderSemanticProjection(first, { truncate }),
    renderSemanticProjection(second, { truncate }),
  );
  assert.deepEqual(first.retrievableRefs, ["cpc-1", "cpc-2"]);
});

test("enforces maxChars and lists omitted ids as retrievable", () => {
  const many = {
    taskId: "t1",
    requirements: Object.fromEntries(
      Array.from({ length: 14 }, (_, i) => [
        `req-${String(i).padStart(2, "0")}`,
        {
          id: `req-${String(i).padStart(2, "0")}`,
          claim: `claim ${i}`,
          status: "PENDING",
          evidence: [{ ref: `ev-${i}`, kind: "support" }],
        },
      ]),
    ),
  };

  const projection = buildSemanticProjection({ taskId: "t1", taskState: baseTask, ledger: many });
  const text = renderSemanticProjection(projection, { maxChars: 200, truncate });

  assert.equal(projection.execution.requirements.length, 10);
  assert.ok(projection.retrievableRefs.includes("req-13"));
  assert.ok(text.length <= 200);
});

test("missing ledger yields an empty but valid projection", () => {
  const projection = buildSemanticProjection({ taskId: "t1" });

  assert.equal(projection.taskId, "t1");
  assert.equal(projection.objective, "unknown");
  assert.deepEqual(projection.constraints, []);
  assert.deepEqual(projection.execution, { requirements: [], pending: [], conflicts: [] });
  assert.deepEqual(projection.decisions, []);
  assert.deepEqual(projection.evidenceRefs, []);
  assert.deepEqual(projection.openItems, []);
  assert.equal(projection.nextObligation, null);
  assert.deepEqual(projection.retrievableRefs, []);
});

test("renders every projection section", () => {
  const projection = buildSemanticProjection({
    taskId: "task-t1",
    taskState: baseTask,
    decisions: [{ id: "task-t1-d1", status: "accepted", decision: "use projection" }],
    ledger,
  });
  const text = renderSemanticProjection(projection, { truncate });

  for (const heading of [
    "objective:",
    "constraints:",
    "execution state:",
    "live decisions:",
    "evidence:",
    "open items:",
    "next obligation:",
    "omitted details (retrievable):",
  ]) {
    assert.ok(text.includes(heading), `missing heading ${heading}`);
  }
});

test("falls back to taskState.nextAction when ledger has no pending obligations", () => {
  const verifiedOnly = {
    taskId: "t1",
    requirements: {
      "req-a": { id: "req-a", claim: "first", status: "VERIFIED", evidence: [] },
    },
  };
  const projection = buildSemanticProjection({
    taskId: "t1",
    taskState: { nextAction: "write tests" },
    ledger: verifiedOnly,
  });

  assert.equal(projection.nextObligation, "write tests");
});

test("keeps pending and evidence-bearing requirements ahead of filler", () => {
  const filler = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      `req-${String(i).padStart(2, "0")}`,
      { id: `req-${String(i).padStart(2, "0")}`, claim: `filler ${i}`, status: "VERIFIED", evidence: [] },
    ]),
  );
  const many = {
    taskId: "t1",
    requirements: {
      ...filler,
      "req-zz-pending": { id: "req-zz-pending", claim: "critical pending", status: "PENDING", evidence: [] },
      "req-zz-evidence": {
        id: "req-zz-evidence",
        claim: "critical evidence",
        status: "VERIFIED",
        evidence: [{ ref: "ev-critical", kind: "support" }],
      },
    },
  };

  const first = buildSemanticProjection({ taskId: "t1", taskState: baseTask, ledger: many });
  const second = buildSemanticProjection({ taskId: "t1", taskState: baseTask, ledger: many });
  const ids = first.execution.requirements.map((req) => req.id);

  assert.equal(ids.length, 10);
  assert.ok(ids.includes("req-zz-pending"), "pending requirement survived the cap");
  assert.ok(ids.includes("req-zz-evidence"), "evidence-bearing requirement survived the cap");
  assert.ok(first.retrievableRefs.includes("req-08"), "dropped filler id remains recoverable");
  assert.deepEqual(first, second, "selection is deterministic");
});
