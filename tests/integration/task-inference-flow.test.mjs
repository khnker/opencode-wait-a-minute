import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskInferenceDirective,
  COMPLETION_TYPE,
} from "../../src/cognition/task-inference-engine.js";

test("deterministic: two calls deep equal", () => {
  const input = {
    objective: "Endpoint health",
    requirements: [{ title: "Habilitar endpoint /health" }],
  };
  assert.deepStrictEqual(
    buildTaskInferenceDirective(input),
    buildTaskInferenceDirective(input)
  );
});

test("directive includes objective, inferred tasks and local/validation criteria", () => {
  const { lines, inferred, objective } = buildTaskInferenceDirective({
    objective: "Create user endpoint",
    requirements: [{ title: "Habilitar endpoint /users" }],
  });
  assert.equal(objective, "Create user endpoint");
  assert.ok(Array.isArray(lines));
  assert.ok(lines.length > 0);
  assert.ok(lines.some((l) => l.toLowerCase().includes("endpoint")));
  assert.ok(lines.some((l) => l.includes("10%")));
  assert.ok(lines.some((l) => l.includes("local")));
  assert.ok(lines.some((l) => l.includes("servicio")));
  assert.ok(inferred.length >= 1);
  const types = inferred.flatMap((t) => t.completionCriteria.map((c) => c.type));
  assert.ok(types.includes(COMPLETION_TYPE.LOCAL_SERVICE));
  assert.ok(types.includes(COMPLETION_TYPE.VALIDATION));
});

test("no requirements → empty directive", () => {
  const { lines, inferred, objective } = buildTaskInferenceDirective({ objective: "Empty" });
  assert.equal(lines.length, 0);
  assert.equal(inferred.length, 0);
  assert.equal(objective, "Empty");
});
