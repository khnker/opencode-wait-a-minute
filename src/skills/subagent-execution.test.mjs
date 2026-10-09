import test from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTION_STRATEGIES,
  declareStrategy,
  validateSubagentOutput,
  checkScope,
  attributeEvidence,
  synthesize,
} from "./subagent-execution.js";

test("strategies declared", () => {
  assert.deepEqual(EXECUTION_STRATEGIES, ["subagent", "direct", "parallel"]);
  assert.equal(declareStrategy({ strategy: "parallel" }).ok, true);
  assert.equal(declareStrategy({ strategy: "magic" }).ok, false);
  assert.equal(declareStrategy({}).strategy, "direct");
});

test("free-form output is rejected", () => {
  assert.equal(validateSubagentOutput({ text: "I did stuff" }).ok, false);
  const good = validateSubagentOutput({ claim: "x", action: "y", observation: "z", evidence: ["e"] });
  assert.equal(good.ok, true);
});

test("out-of-scope work rejected", () => {
  const r = checkScope({ action: { paths: ["src/a.js", "secrets/key"] } }, { paths: ["src/"] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.outOfScope, ["secrets/key"]);
});

test("evidence retains producing subagent id", () => {
  assert.deepEqual(attributeEvidence([{ kind: "log" }], "agent-7"), [{ kind: "log", subagentId: "agent-7" }]);
});

test("synthesis reports MISSING, never fabricates evidence", () => {
  const r = synthesize([{ id: "a", output: { claim: "c", action: "a", observation: "o", evidence: [] } }]);
  assert.deepEqual(r.missing, ["a"]);
  assert.deepEqual(r.evidence, []);
});

test("evidence attributed during synthesis", () => {
  const r = synthesize([{ id: "a", output: { claim: "c", action: "a", observation: "o", evidence: [{ k: 1 }] } }]);
  assert.equal(r.evidence[0].subagentId, "a");
});

test("partial errors recorded, others proceed", () => {
  const r = synthesize([
    { id: "a", error: "boom" },
    { id: "b", output: { claim: "c", action: "a", observation: "o", evidence: ["ok"] } },
  ]);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].subagentId, "a");
  assert.equal(r.evidence.length, 1);
  assert.equal(r.ok, false);
});
