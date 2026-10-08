import { test } from "node:test";
import assert from "node:assert/strict";
import {
  enforceGovernance,
  isTrivialChange,
  isTerminalPhase,
} from "../../src/policy/governance-enforcement.js";
import { WamPolicyBlock } from "../../src/policy/risk-engine.js";

const approved = { phase: "IMPLEMENTING", contract: { status: "APPROVED" } };
const draft = {
  phase: "PROPOSED",
  contract: { status: "PROPOSED" },
  requirements: [{ id: "r1", status: "pending" }],
};

test("allows gated tool with APPROVED contract", () => {
  assert.doesNotThrow(() => enforceGovernance("write", approved));
});

test("allows on terminal phase (DONE / COMPLETE)", () => {
  assert.doesNotThrow(() => enforceGovernance("edit", { phase: "DONE", contract: { status: "PROPOSED" } }));
  assert.doesNotThrow(() => enforceGovernance("edit", { phase: "COMPLETE", contract: { status: "PROPOSED" } }));
});

test("blocks gated tools without approved contract", () => {
  assert.throws(() => enforceGovernance("write", draft), WamPolicyBlock);
  assert.throws(() => enforceGovernance("todo_write", draft), WamPolicyBlock);
  assert.throws(() => enforceGovernance("apply_patch", draft), WamPolicyBlock);
  assert.throws(
    () => enforceGovernance("edit", draft),
    (err) => err instanceof WamPolicyBlock && err.wamPolicyBlock === true && err.name === "WamPolicyBlock"
  );
});

test("allows ASKING (defers to clarification gate)", () => {
  assert.doesNotThrow(() => enforceGovernance("edit", { phase: "ASKING", contract: { status: "PROPOSED" } }));
});

test("untracked session (null/undefined state) fails open", () => {
  assert.doesNotThrow(() => enforceGovernance("write", null));
  assert.doesNotThrow(() => enforceGovernance("write", undefined));
});

test("non-gated tools never throw (bash/read/task)", () => {
  assert.doesNotThrow(() => enforceGovernance("read", draft));
  assert.doesNotThrow(() => enforceGovernance("bash", draft));
  assert.doesNotThrow(() => enforceGovernance("task", draft));
});

test("delegated subagent is exempt", () => {
  assert.doesNotThrow(() => enforceGovernance("write", draft, { isSubagent: true }));
});

test("trivial declared change is allowed", () => {
  assert.doesNotThrow(() => enforceGovernance("write", draft, { declaredFiles: ["a.mjs", "b.mjs"] }));
});

test("non-trivial declared change is blocked", () => {
  assert.throws(() => enforceGovernance("write", draft, { declaredFiles: ["a", "b", "c"] }), WamPolicyBlock);
});

test("protected paths are never trivial", () => {
  assert.equal(isTrivialChange(["ci.yml"]), false);
  assert.equal(isTrivialChange([".github/workflows/ci.yml"]), false);
  assert.equal(isTrivialChange(["migrations/001.sql"]), false);
  assert.throws(() => enforceGovernance("write", draft, { declaredFiles: ["ci.yml"] }), WamPolicyBlock);
});

test("override (WAM_GOVERNANCE=off) disables enforcement", () => {
  const prev = process.env.WAM_GOVERNANCE;
  process.env.WAM_GOVERNANCE = "off";
  try {
    assert.doesNotThrow(() => enforceGovernance("write", draft));
  } finally {
    if (prev === undefined) delete process.env.WAM_GOVERNANCE;
    else process.env.WAM_GOVERNANCE = prev;
  }
});

test("isTerminalPhase", () => {
  assert.equal(isTerminalPhase("DONE"), true);
  assert.equal(isTerminalPhase("COMPLETE"), true);
  assert.equal(isTerminalPhase("PROPOSED"), false);
});


// --- regression: deadlock produced by a tracked PROPOSED contract with 0 requirements ---
const emptyDraft = { phase: "PROPOSED", contract: { status: "PROPOSED" }, requirements: [] };

test("empty-contract fix: tracked PROPOSED with 0 requirements fails open (no deadlock)", () => {
  assert.doesNotThrow(() => enforceGovernance("write", emptyDraft));
  assert.doesNotThrow(() => enforceGovernance("edit", emptyDraft));
  assert.doesNotThrow(() => enforceGovernance("todo_write", emptyDraft));
  assert.doesNotThrow(() => enforceGovernance("apply_patch", emptyDraft));
});

test("empty-contract fix: a blocking unknown still gates an otherwise empty contract", () => {
  const withUnknown = {
    phase: "PROPOSED",
    contract: { status: "PROPOSED", unknowns: [{ id: "U1", status: "blocking", question: "?" }] },
    requirements: [],
  };
  assert.throws(() => enforceGovernance("write", withUnknown), WamPolicyBlock);
});

test("empty-contract fix: any pending requirement still gates", () => {
  assert.throws(
    () => enforceGovernance("write", { phase: "PROPOSED", contract: { status: "PROPOSED" }, requirements: [{ id: "r1" }] }),
    WamPolicyBlock
  );
});

test("trivial escape reachable via declaredFiles (single src file)", () => {
  assert.doesNotThrow(() =>
    enforceGovernance("write", emptyDraft, { declaredFiles: ["src/skills/skill-inference.test.mjs"] })
  );
});
