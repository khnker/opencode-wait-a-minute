import test from "node:test";
import assert from "node:assert/strict";
import {
  TASK_KINDS,
  inferTaskKind,
  normalizeTaskKind,
  resolveQualityContract,
  collectTaskEvidence,
  evaluateEvidenceSufficiency,
  evaluateTaskQuality,
  detectStaleEvidence,
  detectContradictions,
} from "./task-quality-contract.js";
import { TASK_EVIDENCE_TYPES, TASK_EVIDENCE_STRENGTH } from "../verification/outcome-evaluator.js";

const direct = (criterionId, overrides = {}) => ({
  criterionId,
  type: TASK_EVIDENCE_TYPES.DIRECT,
  strength: TASK_EVIDENCE_STRENGTH.L3_DIRECT,
  status: "pass",
  ...overrides,
});

const testResult = (criterionId, overrides = {}) => ({
  criterionId,
  type: TASK_EVIDENCE_TYPES.TEST_RESULT,
  strength: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION,
  status: "pass",
  ...overrides,
});

test("kind normalization accepts aliases and rejects noise", () => {
  assert.equal(normalizeTaskKind("Creation"), TASK_KINDS.IMPLEMENTATION);
  assert.equal(normalizeTaskKind("bugfix"), TASK_KINDS.DEBUGGING);
  assert.equal(normalizeTaskKind("docs"), TASK_KINDS.DOCUMENTATION);
  assert.equal(normalizeTaskKind("unknownish"), TASK_KINDS.UNKNOWN);
  assert.equal(normalizeTaskKind(undefined), TASK_KINDS.UNKNOWN);
});

test("kind inference prefers explicit metadata, then objective text", () => {
  assert.equal(inferTaskKind({ kind: "review", objective: "fix a bug" }), TASK_KINDS.REVIEW);
  assert.equal(inferTaskKind({ objective: "Investigate cache eviction strategies" }), TASK_KINDS.RESEARCH);
  assert.equal(inferTaskKind({ objective: "Refactor the scheduler" }), TASK_KINDS.REFACTORING);
  assert.equal(inferTaskKind({ objective: "Fix the flaky login test" }), TASK_KINDS.DEBUGGING);
  assert.equal(inferTaskKind({ objective: "Implement retry backoff" }), TASK_KINDS.IMPLEMENTATION);
  assert.equal(inferTaskKind({ objective: "Ship it" }), TASK_KINDS.UNKNOWN);
});

test("criterion evidenceRequirements override the kind profile", () => {
  const task = {
    kind: "implementation",
    outcomeContract: {
      acceptanceCriteria: [
        {
          id: "c1",
          mandatory: true,
          evidenceRequirements: { types: [TASK_EVIDENCE_TYPES.USER_CONFIRMATION], minStrength: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION },
        },
      ],
    },
  };
  const contract = resolveQualityContract(task);
  assert.equal(contract.criteria[0].source, "criterion");
  assert.deepEqual(contract.criteria[0].requirements[0].types, [TASK_EVIDENCE_TYPES.USER_CONFIRMATION]);
  assert.equal(contract.criteria[0].requirements.length, 1);
});

test("kind profile applies when the criterion declares nothing", () => {
  const task = { kind: "implementation", requirements: [{ id: "r1" }] };
  const contract = resolveQualityContract(task);
  assert.equal(contract.criteria[0].source, "kind");
  assert.equal(contract.criteria[0].requirements.length, 2);
});

test("implementation requires a test result and a direct artifact", () => {
  const task = { kind: "implementation", requirements: [{ id: "r1" }] };
  const missing = evaluateTaskQuality(task, [direct("r1")]);
  assert.equal(missing.evaluation.sufficient, false);
  assert.ok(missing.evaluation.missing.some((entry) => entry.types.includes(TASK_EVIDENCE_TYPES.TEST_RESULT)));

  const complete = evaluateTaskQuality(task, [direct("r1"), testResult("r1")]);
  assert.equal(complete.evaluation.sufficient, true);
  assert.equal(complete.evaluation.score, 1);
});

test("a bare claim does not satisfy an observation requirement", () => {
  const task = { kind: "research", requirements: [{ id: "r1" }] };
  const result = evaluateTaskQuality(task, [
    { criterionId: "r1", type: TASK_EVIDENCE_TYPES.DIRECT, strength: TASK_EVIDENCE_STRENGTH.L0_CLAIM },
  ]);
  assert.equal(result.evaluation.sufficient, false);
  assert.equal(result.evaluation.missing[0].reason, "insufficient-strength-or-count");
});

test("optional criteria do not gate sufficiency", () => {
  const task = {
    kind: "research",
    outcomeContract: {
      acceptanceCriteria: [
        { id: "r1", mandatory: true, evidenceRequirements: { types: [TASK_EVIDENCE_TYPES.DIRECT] } },
        { id: "r2", mandatory: false, evidenceRequirements: { types: [TASK_EVIDENCE_TYPES.TEST_RESULT] } },
      ],
    },
  };
  const result = evaluateTaskQuality(task, [direct("r1")]);
  assert.equal(result.evaluation.sufficient, true);
  assert.equal(result.evaluation.score, 1);
});

test("stale hash evidence is excluded from sufficiency", () => {
  const task = { kind: "research", requirements: [{ id: "r1" }] };
  const evidence = [direct("r1", { id: "e1", sourceRef: "src/a.js", hash: "old" })];
  const stale = detectStaleEvidence(evidence, { hashes: { "src/a.js": "new" } });
  assert.equal(stale.length, 1);
  assert.equal(stale[0].reason, "hash-mismatch");

  const result = evaluateTaskQuality(task, evidence, { hashes: { "src/a.js": "new" } });
  assert.equal(result.evaluation.sufficient, false);
  assert.equal(result.evaluation.stale.length, 1);
});

test("expired evidence is stale only when a max age is set", () => {
  const evidence = [direct("r1", { timestamp: "2026-01-01T00:00:00.000Z" })];
  const now = Date.parse("2026-02-01T00:00:00.000Z");
  assert.equal(detectStaleEvidence(evidence, { now }).length, 0);
  assert.equal(detectStaleEvidence(evidence, { now, maxAgeMs: 1000 }).length, 1);
});

test("failed evidence on a mandatory criterion is a contradiction", () => {
  const task = { kind: "research", requirements: [{ id: "r1" }] };
  const result = evaluateTaskQuality(task, [direct("r1", { status: "failed" })]);
  assert.equal(result.evaluation.sufficient, false);
  assert.equal(result.evaluation.contradictions[0].reason, "failed-evidence");
});

test("conflicting hashes contradict unless one supersedes the other", () => {
  const task = { kind: "research", requirements: [{ id: "r1" }] };
  const conflicting = [
    direct("r1", { id: "e1", sourceRef: "src/a.js", hash: "h1" }),
    direct("r1", { id: "e2", sourceRef: "src/a.js", hash: "h2" }),
  ];
  assert.equal(detectContradictions(resolveQualityContract(task), conflicting).length, 1);

  const resolved = [
    direct("r1", { id: "e1", sourceRef: "src/a.js", hash: "h1" }),
    direct("r1", { id: "e2", sourceRef: "src/a.js", hash: "h2", supersedes: ["e1"] }),
  ];
  assert.equal(detectContradictions(resolveQualityContract(task), resolved).length, 0);
});

test("unknown kind applies only criterion-level requirements", () => {
  const task = { objective: "Ship it", requirements: [{ id: "r1" }] };
  const contract = resolveQualityContract(task);
  assert.equal(contract.kind, TASK_KINDS.UNKNOWN);
  assert.equal(contract.criteria[0].requirements.length, 0);
  assert.equal(evaluateEvidenceSufficiency(contract, []).sufficient, true);
});

test("collectTaskEvidence flattens requirement evidence without inventing strength", () => {
  const task = {
    requirements: [
      { id: "r1", evidence: ["src/a.js", { type: TASK_EVIDENCE_TYPES.TEST_RESULT }] },
      { id: "r2", evidence: [{ criterionId: "r2", type: TASK_EVIDENCE_TYPES.DIRECT, strength: TASK_EVIDENCE_STRENGTH.L3_DIRECT }] },
    ],
  };
  const evidence = collectTaskEvidence(task);
  assert.equal(evidence.length, 3);
  assert.equal(evidence[0].criterionId, "r1");
  assert.equal(evidence[1].criterionId, "r1");
  assert.equal(evidence[2].criterionId, "r2");
  assert.equal(evidence[0].type, TASK_EVIDENCE_TYPES.DIRECT);
});

test("evaluateEvidenceSufficiency rejects an unresolved contract", () => {
  assert.throws(() => evaluateEvidenceSufficiency({}, []), TypeError);
});
