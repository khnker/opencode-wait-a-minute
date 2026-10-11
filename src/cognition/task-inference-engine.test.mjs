import {
  inferNextTasks,
  generateCompletionCriteria,
  evaluateCompletion,
  buildTaskInferenceDirective,
  COMPLETION_TYPE,
} from "./task-inference-engine.js";
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

console.log("Task Inference Engine");

test("inferNextTasks: requiresVerification → -verify task with validation+local-service criteria", () => {
  const list = [
    { id: "task1", description: "Implement feature", requiresVerification: true },
  ];
  const inferred = inferNextTasks(list, {});
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "task1-verify");
  assert.equal(inferred[0].implicit, false);
  assert.deepEqual(inferred[0].dependsOn, ["task1"]);
  const types = inferred[0].completionCriteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.VALIDATION));
  assert.ok(types.includes(COMPLETION_TYPE.LOCAL_SERVICE));
  // Weights should be normalized to sum 1.0
  const sum = inferred[0].completionCriteria.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights should sum to 1, got ${sum}`);
});

test("inferNextTasks: dataIntensive → -review task with DATA_REVIEW", () => {
  const inferred = inferNextTasks(
    [{ id: "ingest", description: "Ingest dataset", dataIntensive: true }],
    {}
  );
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "ingest-review");
  const types = inferred[0].completionCriteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.DATA_REVIEW));
});

test("inferNextTasks: isService → -monitor task with LOCAL_SERVICE + MONITORING", () => {
  const inferred = inferNextTasks(
    [{ id: "api", description: "Expose API", isService: true }],
    {}
  );
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "api-monitor");
  const types = inferred[0].completionCriteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.LOCAL_SERVICE));
  assert.ok(types.includes(COMPLETION_TYPE.MONITORING));
});

test("inferNextTasks: deploy tag → -rollback task", () => {
  const inferred = inferNextTasks(
    [{ id: "ship", description: "Ship v2", tags: ["deploy"] }],
    {}
  );
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "ship-rollback");
  const types = inferred[0].completionCriteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.ROLLBACK_PLAN));
});

test("inferNextTasks: public tag → -docs task with DOCUMENTATION", () => {
  const inferred = inferNextTasks(
    [{ id: "flag", description: "Roll out public flag", tags: ["public"] }],
    {}
  );
  assert.equal(inferred.length, 1);
  assert.equal(inferred[0].id, "flag-docs");
  const types = inferred[0].completionCriteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.DOCUMENTATION));
});

test("inferNextTasks: combined flags infer multiple non-implicit tasks", () => {
  const inferred = inferNextTasks(
    [
      {
        id: "feature",
        description: "Ship feature",
        requiresVerification: true,
        isService: true,
        tags: ["deploy", "public"],
      },
    ],
    {}
  );
  const ids = inferred.map((t) => t.id).sort();
  assert.deepEqual(ids, [
    "feature-docs",
    "feature-monitor",
    "feature-rollback",
    "feature-verify",
  ]);
  for (const t of inferred) assert.equal(t.implicit, false);
});

test("inferNextTasks: idempotent — running twice yields same count", () => {
  const list = [
    { id: "t1", description: "x", requiresVerification: true, isService: true },
  ];
  const a = inferNextTasks(list, {});
  const b = inferNextTasks([...list, ...a], {});
  assert.equal(b.length, 0, "no new tasks should be inferred once prior inferred ones are present");
});

test("inferNextTasks: rejects non-array input", () => {
  assert.throws(() => inferNextTasks(null, {}), TypeError);
  assert.throws(() => inferNextTasks("nope", {}), TypeError);
});

test("inferNextTasks: skips tasks without id and does not throw", () => {
  const inferred = inferNextTasks(
    [{ description: "no id", requiresVerification: true }, { id: "ok" }],
    {}
  );
  assert.equal(inferred.length, 0);
});

test("generateCompletionCriteria: dataIntensive + isService yields both criteria", () => {
  const criteria = generateCompletionCriteria({
    id: "svc",
    dataIntensive: true,
    isService: true,
  });
  const types = criteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.DATA_REVIEW));
  assert.ok(types.includes(COMPLETION_TYPE.LOCAL_SERVICE));
  // Baseline validation always present
  assert.ok(types.includes(COMPLETION_TYPE.VALIDATION));
  // Weights sum to 1.0
  const sum = criteria.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights should sum to 1, got ${sum}`);
  // Returned array is frozen for safety
  assert.ok(Object.isFrozen(criteria));
  assert.ok(Object.isFrozen(criteria[0]));
});

test("generateCompletionCriteria: minimal task still gets baseline validation", () => {
  const criteria = generateCompletionCriteria({ id: "minimal" });
  assert.equal(criteria.length, 1);
  assert.equal(criteria[0].type, COMPLETION_TYPE.VALIDATION);
});

test("generateCompletionCriteria: deploy tag → ROLLBACK_PLAN criterion", () => {
  const criteria = generateCompletionCriteria({
    id: "ship",
    tags: ["deploy"],
  });
  assert.ok(criteria.some((c) => c.type === COMPLETION_TYPE.ROLLBACK_PLAN));
});

test("generateCompletionCriteria: rejects non-object input", () => {
  assert.throws(() => generateCompletionCriteria(null), TypeError);
  assert.throws(() => generateCompletionCriteria("nope"), TypeError);
});

test("evaluateCompletion: passes when achieved weight ≥ minCompletionWeight (default 0.6)", () => {
  const criteria = [
    { type: COMPLETION_TYPE.VALIDATION, weight: 0.5, passed: true },
    { type: COMPLETION_TYPE.LOCAL_SERVICE, weight: 0.5, passed: true },
  ];
  const result = evaluateCompletion(criteria);
  assert.equal(result.canComplete, true);
  assert.equal(result.achievedWeight, 1.0);
  assert.deepEqual(result.missing, []);
});

test("evaluateCompletion: fails when below threshold and reports missing", () => {
  const criteria = [
    { type: COMPLETION_TYPE.VALIDATION, weight: 0.4, passed: true },
    { type: COMPLETION_TYPE.DATA_REVIEW, weight: 0.6, passed: false },
  ];
  const result = evaluateCompletion(criteria);
  assert.equal(result.canComplete, false);
  assert.equal(result.achievedWeight, 0.4);
  assert.deepEqual(result.missing, [COMPLETION_TYPE.DATA_REVIEW]);
});

test("evaluateCompletion: custom minCompletionWeight honored", () => {
  const criteria = [
    { type: COMPLETION_TYPE.VALIDATION, weight: 0.5, passed: true },
    { type: COMPLETION_TYPE.LOCAL_SERVICE, weight: 0.5, passed: false },
  ];
  assert.equal(evaluateCompletion(criteria, { minCompletionWeight: 0.5 }).canComplete, true);
  assert.equal(evaluateCompletion(criteria, { minCompletionWeight: 0.51 }).canComplete, false);
});

test("evaluateCompletion: rejects non-array input", () => {
  assert.throws(() => evaluateCompletion(null), TypeError);
  assert.throws(() => evaluateCompletion({}), TypeError);
});

test("end-to-end: inferred task with all criteria passed can be completed", () => {
  const list = [
    { id: "ship", description: "Ship v1", requiresVerification: true, isService: true },
  ];
  const inferred = inferNextTasks(list, {});
  const verify = inferred.find((t) => t.id === "ship-verify");
  assert.ok(verify);
  const allPassed = verify.completionCriteria.map((c) => ({ ...c, passed: true }));
  const result = evaluateCompletion(allPassed);
  assert.equal(result.canComplete, true);
  assert.equal(result.missing.length, 0);
});

test("generateCompletionCriteria: breaking tag → includes DOCUMENTATION", () => {
  const criteria = generateCompletionCriteria({ id: "x", tags: ["breaking"] }, {});
  const types = criteria.map((c) => c.type);
  assert.ok(types.includes(COMPLETION_TYPE.DOCUMENTATION));
  const sum = criteria.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights should sum to 1, got ${sum}`);
});

test("evaluateCompletion: boundary at exactly minCompletionWeight", () => {
  const pass = evaluateCompletion([{ type: COMPLETION_TYPE.VALIDATION, weight: 0.6, passed: true }]);
  assert.equal(pass.canComplete, true);
  const fail = evaluateCompletion([{ type: COMPLETION_TYPE.VALIDATION, weight: 0.5999, passed: true }]);
  assert.equal(fail.canComplete, false);
});

test("normalizeWeights: three criteria sum exactly 1 and stay positive", () => {
  const criteria = generateCompletionCriteria({ id: "t", dataIntensive: true, tags: ["deploy"] });
  assert.equal(criteria.length, 3);
  const sum = criteria.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weights should sum to 1, got ${sum}`);
  assert.ok(criteria.every((c) => c.weight > 0));
});

test("buildTaskInferenceDirective: endpoint infers local-service + validation", () => {
  const { lines, inferred, objective } = buildTaskInferenceDirective({
    objective: "Habilitar endpoint /health",
    requirements: [{ title: "Habilitar endpoint /health", description: "Enable /health" }],
  });
  assert.equal(objective, "Habilitar endpoint /health");
  assert.ok(inferred.length >= 1);
  const types = inferred.flatMap((t) => t.completionCriteria.map((c) => c.type));
  assert.ok(types.includes(COMPLETION_TYPE.LOCAL_SERVICE));
  assert.ok(types.includes(COMPLETION_TYPE.VALIDATION));
  assert.ok(lines.some((l) => l.includes("10%")));
  assert.ok(lines.some((l) => l.toLowerCase().includes("local")));
});

test("buildTaskInferenceDirective: no requirements → empty directive", () => {
  const { lines, inferred, objective } = buildTaskInferenceDirective({ objective: "Empty" });
  assert.equal(lines.length, 0);
  assert.equal(inferred.length, 0);
  assert.equal(objective, "Empty");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
