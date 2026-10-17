import {
  selectRole,
  scoreRoles,
  buildRoleDirective,
  ROLE,
} from "./task-role-engine.js";
import assert from "assert/strict";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(err);
  }
}

console.log("Task Role Engine");

test("scoreRoles: returns all roles with non-negative scores, sorted desc", () => {
  const ranked = scoreRoles({ objective: "Implement feature X", requirements: [] });
  assert.equal(ranked.length, Object.values(ROLE).length);
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
});

test("selectRole: verify-suffix requirement → VERIFIER with high confidence", () => {
  const out = selectRole({
    objective: "Implement endpoint",
    requirements: [{ id: "auth-verify", description: "verify auth flow" }],
  });
  assert.equal(out.role, ROLE.VERIFIER);
  assert.ok(out.confidence > 0.4, `expected confidence > 0.4 got ${out.confidence}`);
  assert.ok(out.evidence.some((e) => e.signalId === "verify-suffix"));
});

test("selectRole: review-suffix requirement → REVIEWER", () => {
  const out = selectRole({
    objective: "Implement ingest",
    requirements: [{ id: "ingest-review", description: "review data" }],
  });
  assert.equal(out.role, ROLE.REVIEWER);
});

test("selectRole: rollback / deploy requirement → OPERATOR", () => {
  const out = selectRole({
    objective: "Implement feature",
    requirements: [{ id: "deploy-rollback", description: "rollback plan" }],
  });
  assert.equal(out.role, ROLE.OPERATOR);
});

test("selectRole: monitoring / service requirement → OPERATOR", () => {
  const out = selectRole({
    objective: "Implement endpoint",
    requirements: [
      { id: "health-monitor", description: "monitor service health", isService: true },
    ],
  });
  assert.equal(out.role, ROLE.OPERATOR);
});

test("selectRole: docs / public requirement → DOC_WRITER", () => {
  const out = selectRole({
    objective: "Implement library",
    requirements: [{ id: "public-docs", description: "write docs", public: true }],
  });
  assert.equal(out.role, ROLE.DOC_WRITER);
});

test("selectRole: free-text 'plan the architecture' (no implement verb) → PLANNER", () => {
  const out = selectRole({
    objective: "Plan the architecture of the new module",
    requirements: [],
  });
  assert.equal(out.role, ROLE.PLANNER);
});

test("selectRole: free-text 'implement and build X' → IMPLEMENTER", () => {
  const out = selectRole({
    objective: "Build a new CLI command",
    requirements: [],
  });
  assert.equal(out.role, ROLE.IMPLEMENTER);
});

test("selectRole: empty input falls back to IMPLEMENTER with confidence 0", () => {
  const out = selectRole({ objective: "", requirements: [] });
  assert.equal(out.role, ROLE.IMPLEMENTER);
  assert.equal(out.confidence, 0);
});

test("selectRole: type-checks inputs", () => {
  assert.throws(() => selectRole({ objective: 42, requirements: [] }), TypeError);
  assert.throws(() => selectRole({ objective: "", requirements: "nope" }), TypeError);
});

test("selectRole: idempotent (same input → same output)", () => {
  const input = {
    objective: "Implement X",
    requirements: [{ id: "x-verify", description: "verify" }],
  };
  const a = JSON.stringify(selectRole(input));
  const b = JSON.stringify(selectRole(input));
  assert.equal(a, b);
});

test("selectRole: prefers suffix signals over free-text when conflicting", () => {
  // objective says "implement", but requirements say -verify → VERIFIER wins
  const out = selectRole({
    objective: "Implement new feature",
    requirements: [{ id: "core-verify", description: "verify core" }],
  });
  assert.equal(out.role, ROLE.VERIFIER);
});

test("buildRoleDirective: returns lines + role + confidence; includes header", () => {
  const { lines, role, confidence } = buildRoleDirective({
    objective: "Implement X",
    requirements: [{ id: "x-verify", description: "verify" }],
  });
  assert.ok(Array.isArray(lines));
  assert.ok(lines.length >= 3);
  assert.ok(typeof role === "string");
  assert.ok(typeof confidence === "number");
  assert.ok(lines.some((l) => /\[wam role\]/.test(l)));
  assert.ok(lines.some((l) => /Verifier Mode|Implementer Mode|Reviewer Mode|Operator Mode|Doc-Writer Mode|Planner Mode/.test(l)));
});

test("buildRoleDirective: idempotent (same input → identical lines)", () => {
  const input = { objective: "Implement Y", requirements: [] };
  const a = buildRoleDirective(input);
  const b = buildRoleDirective(input);
  assert.deepEqual(a.lines, b.lines);
  assert.equal(a.role, b.role);
  assert.equal(a.confidence, b.confidence);
});

test("scoreRoles: does not double-count free-text signal if per-req already triggered same role", () => {
  // If verify-suffix already fired for a requirement, prompt-verify must not
  // add a second hit to VERIFIER's score on the synthetic prompt requirement.
  const ranked = scoreRoles({
    objective: "Implement feature",
    requirements: [{ id: "core-verify" }],
  });
  const verifier = ranked.find((r) => r.role === ROLE.VERIFIER);
  const verifyHits = verifier.hits.filter((h) => h.signalId === "prompt-verify");
  assert.equal(verifyHits.length, 0, "prompt-verify should not double-count after verify-suffix");
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log(`\n${passed} passed`);
