import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContextBrief } from "./context-brief.js";

const taskState = {
  phase: "IMPLEMENTING",
  contract: {
    objective: "Do the thing",
    status: "APPROVED",
    constraints: ["no deps"],
    nonGoals: ["no UI"],
    unknowns: [{ id: "u1", question: "Which cap?", status: "blocking" }],
  },
  requirements: [
    { id: "r1", title: "first", status: "pending" },
    { id: "r2", title: "second", status: "verified" },
  ],
};

const decisions = [{ id: "d1", status: "accepted", decision: "use it" }];
const entities = [{ kind: "file", value: "src/x.js" }];

const legacyExpected = [
  "[wam context brief]",
  "task: t1 — IMPLEMENTING / APPROVED",
  "objective: Do the thing",
  "requirements: 1 open / 2 total",
  "- open r1: first (pending)",
  "- verified r2: second",
  "constraints:",
  "- no deps",
  "non-goals:",
  "- no UI",
  "decisions:",
  "- use it",
  "entities:",
  "- file=src/x.js",
  "blocking questions:",
  "- u1: Which cap?",
].join("\n");

const ledger = {
  taskId: "t1",
  requirements: {
    "req-a": {
      id: "req-a",
      claim: "first",
      status: "PENDING",
      evidence: [{ ref: "ev-1", kind: "support" }],
    },
    "req-b": {
      id: "req-b",
      claim: "second",
      status: "VERIFIED",
      evidence: [{ ref: "ev-2", kind: "support" }],
    },
    "req-c": {
      id: "req-c",
      claim: "third",
      status: "SUPPORTED",
      evidence: [{ ref: "ev-3", kind: "conflict", note: "differs from ev-9" }],
    },
  },
};

test("without ledger the legacy brief is unchanged", () => {
  const brief = buildContextBrief({ taskId: "t1", taskState, decisions, entities });

  assert.equal(brief.text, legacyExpected);
});

test("a root without a ledger keeps the legacy brief", () => {
  const brief = buildContextBrief({
    taskId: "t1",
    taskState,
    decisions,
    entities,
    root: "/tmp/wam-no-such-root",
  });

  assert.equal(brief.text, legacyExpected);
});

test("with a ledger the brief carries projection sections", () => {
  const brief = buildContextBrief({ taskId: "t1", taskState, decisions, entities, ledger });

  assert.ok(brief.text.includes("execution state:"));
  assert.ok(brief.text.includes("live decisions:"));
  assert.ok(brief.text.includes("evidence:"));
  assert.ok(brief.text.includes("open items:"));
  assert.ok(brief.text.includes("next obligation:"));
  assert.ok(brief.text.includes("omitted details (retrievable):"));
  assert.equal(brief.text.match(/^objective:/gm).length, 1);
  assert.ok(brief.text.includes("requirements: 1 open / 2 total"));
  assert.ok(brief.text.includes("blocking questions:"));
  assert.ok(!brief.text.includes("\ndecisions:"));
  assert.equal(brief.text.match(/^constraints:$/gm).length, 1);
});

test("a corrupt ledger falls back to the legacy brief", () => {
  const corrupt = {
    taskId: "t1",
    requirements: {
      "req-a": { id: "req-a", claim: "first", status: "PENDING", evidence: null },
    },
  };
  const brief = buildContextBrief({ taskId: "t1", taskState, decisions, entities, ledger: corrupt });

  assert.equal(brief.text, legacyExpected);
});

test("maxChars caps the combined brief", () => {
  const brief = buildContextBrief({ taskId: "t1", taskState, decisions, entities, ledger, maxChars: 160 });

  assert.ok(brief.text.length <= 160);
});
