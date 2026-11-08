import test from "node:test";
import assert from "node:assert/strict";

import {
  AgentContextError,
  ROLE_CONTEXT_POLICY,
  selectRoleContext,
} from "../../src/agents/context-isolation.js";

function finding(overrides = {}) {
  return {
    id: "F1",
    description: "Missing auth check",
    severity: "HIGH",
    evidence: ["ev-1"],
    ...overrides,
  };
}

function select(overrides = {}) {
  return selectRoleContext({
    role: "REVIEWER",
    objective: "review the auth change",
    artifacts: ["src/auth.js"],
    evidence: ["ev-1"],
    constraints: ["Do not modify WAM state"],
    priorFindings: [finding()],
    ...overrides,
  });
}

test("declares a role policy for all four roles", () => {
  assert.deepEqual(Object.keys(ROLE_CONTEXT_POLICY), [
    "ANALYST",
    "ARCHITECT",
    "BUILDER",
    "BACKEND_ENGINEER",
    "FRONTEND_ENGINEER",
    "UX_DESIGNER",
    "REVIEWER",
  ]);
});

test("returns only the four contract input categories", () => {
  const result = select({ conversation: ["coordinator transcript"] });
  assert.deepEqual(Object.keys(result.input), [
    "artifacts",
    "evidence",
    "constraints",
    "priorFindings",
  ]);
  assert.equal(result.input.conversation, undefined);
  assert.equal(result.metadata.role, "REVIEWER");
});

test("Analyst starts without prior findings", () => {
  const result = select({
    role: "ANALYST",
    priorFindings: [finding(), finding({ id: "F2", severity: "CRITICAL" })],
  });
  assert.deepEqual(result.input.priorFindings, []);
  assert.equal(result.metadata.omitted.priorFindings, 2);
});

test("Architect sees all finding severities", () => {
  const result = select({
    role: "ARCHITECT",
    priorFindings: [
      finding({ id: "F1", severity: "LOW" }),
      finding({ id: "F2", severity: "CRITICAL" }),
    ],
  });
  assert.deepEqual(result.input.priorFindings.map((item) => item.id), ["F1", "F2"]);
});

test("Builder keeps only high and critical findings", () => {
  const result = select({
    role: "BUILDER",
    priorFindings: [
      finding({ id: "F1", severity: "LOW" }),
      finding({ id: "F2", severity: "MEDIUM" }),
      finding({ id: "F3", severity: "HIGH" }),
      finding({ id: "F4", severity: "CRITICAL" }),
    ],
  });
  assert.deepEqual(result.input.priorFindings.map((item) => item.id), ["F3", "F4"]);
  assert.equal(result.metadata.omitted.priorFindings, 2);
});

test("Reviewer keeps every finding severity", () => {
  const result = select({
    role: "REVIEWER",
    priorFindings: [
      finding({ id: "F1", severity: "LOW" }),
      finding({ id: "F2", severity: "MEDIUM" }),
      finding({ id: "F3", severity: "HIGH" }),
      finding({ id: "F4", severity: "CRITICAL" }),
    ],
  });
  assert.deepEqual(result.input.priorFindings.map((item) => item.id), ["F1", "F2", "F3", "F4"]);
});

test("ranks artifacts and evidence by objective tokens", () => {
  const result = select({
    objective: "migration",
    artifacts: ["src/ui.js", "db/migration.js", "docs/readme.md"],
    evidence: ["ui test", "migration verified", "readme review"],
  });
  assert.deepEqual(result.input.artifacts, ["db/migration.js", "src/ui.js", "docs/readme.md"]);
  assert.deepEqual(result.input.evidence, ["migration verified", "ui test", "readme review"]);
});

test("keeps constraints in declared order", () => {
  const result = select({
    objective: "migration",
    constraints: ["Do not modify WAM state", "Never commit", "Use Node 20"],
  });
  assert.deepEqual(result.input.constraints, [
    "Do not modify WAM state",
    "Never commit",
    "Use Node 20",
  ]);
});

test("deduplicates refs and finding ids keeping the first occurrence", () => {
  const result = select({
    artifacts: ["src/a.js", "src/a.js", "src/b.js"],
    evidence: ["ev-1", "ev-1"],
    constraints: ["same", "same"],
    priorFindings: [finding({ id: "F1" }), finding({ id: "F1", severity: "CRITICAL" })],
  });
  assert.deepEqual(result.input.artifacts, ["src/a.js", "src/b.js"]);
  assert.deepEqual(result.input.evidence, ["ev-1"]);
  assert.deepEqual(result.input.constraints, ["same"]);
  assert.deepEqual(result.input.priorFindings.map((item) => item.id), ["F1"]);
  assert.equal(result.input.priorFindings[0].severity, "HIGH");
});

test("ranks findings by description overlap", () => {
  const result = select({
    objective: "auth",
    role: "REVIEWER",
    priorFindings: [
      finding({ id: "F1", description: "database index is stale" }),
      finding({ id: "F2", description: "missing auth check" }),
    ],
  });
  assert.deepEqual(result.input.priorFindings.map((item) => item.id), ["F2", "F1"]);
});

test("enforces per-source item limits", () => {
  const artifacts = Array.from({ length: 20 }, (_, index) => `src/file-${index}.js`);
  const result = select({ role: "ANALYST", artifacts });
  assert.equal(result.input.artifacts.length, 16);
  assert.equal(result.metadata.selected.artifacts, 16);
  assert.equal(result.metadata.omitted.artifacts, 4);
});

test("enforces per-source character budgets", () => {
  const result = select({
    maxChars: 400,
    maxCharsPerSource: 15,
    artifacts: [`src/${"a".repeat(50)}.js`, "src/b.js", "src/c.js"],
    evidence: [],
    constraints: [],
    priorFindings: [],
  });
  assert.equal(result.metadata.budget.maxCharsPerSource, 15);
  assert.ok(result.metadata.budget.usedChars <= 15);
  assert.deepEqual(result.input.artifacts, ["src/b.js"]);
  assert.equal(result.metadata.omitted.artifacts, 2);
});

test("caps per-source budget to one quarter of the total", () => {
  const result = select({
    maxChars: 400,
    maxCharsPerSource: 1000,
    artifacts: [],
    evidence: [],
    constraints: [],
    priorFindings: [],
  });
  assert.equal(result.metadata.budget.maxCharsPerSource, 100);
});

test("accepts findings with empty evidence", () => {
  const result = select({ priorFindings: [finding({ evidence: [] })] });
  assert.deepEqual(result.input.priorFindings, [{
    id: "F1",
    description: "Missing auth check",
    severity: "HIGH",
    evidence: [],
  }]);
});

test("is deterministic for identical input", () => {
  const args = {
    role: "BUILDER",
    objective: "migration",
    artifacts: ["src/b.js", "db/migration.js"],
    evidence: ["ev-b", "ev-migration"],
    constraints: ["c1", "c2"],
    priorFindings: [finding({ severity: "CRITICAL" })],
  };
  assert.deepEqual(selectRoleContext(args), selectRoleContext(args));
});

test("fails loud on unknown roles", () => {
  assert.throws(
    () => select({ role: "VERIFIER" }),
    (error) => error instanceof AgentContextError && /unknown role/.test(error.message),
  );
});

test("fails loud on invalid sources and refs", () => {
  assert.throws(
    () => select({ artifacts: "src/a.js" }),
    (error) => error instanceof AgentContextError &&
      error.issues.includes("artifacts must be an array"),
  );
  assert.throws(
    () => select({ evidence: ["ev-1", ""] }),
    (error) => error instanceof AgentContextError &&
      error.issues.includes("evidence[1] must be a non-empty string"),
  );
});

test("fails loud on malformed findings", () => {
  assert.throws(
    () => select({ priorFindings: [{ id: "F1", severity: "HIGH", evidence: [] }] }),
    (error) => error instanceof AgentContextError &&
      error.issues.includes("priorFindings[0].description must be a non-empty string"),
  );
  assert.throws(
    () => select({ priorFindings: [finding({ severity: "URGENT" })] }),
    (error) => error instanceof AgentContextError &&
      /priorFindings\[0\]\.severity must be one of/.test(error.message),
  );
});

test("fails loud on invalid budgets and objective", () => {
  assert.throws(
    () => select({ objective: "" }),
    (error) => error instanceof AgentContextError &&
      error.issues.includes("objective must be a non-empty string"),
  );
  assert.throws(
    () => select({ maxChars: 0 }),
    (error) => error instanceof AgentContextError &&
      error.issues.includes("maxChars must be a positive integer"),
  );
});
