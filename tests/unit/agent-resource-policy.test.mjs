import test from "node:test";
import assert from "node:assert/strict";

import { RoleContractError } from "../../src/agents/role-contracts.js";
import {
  AGENT_RESOURCE_LIMITS,
  assertResultResources,
  resolveResourceLimits,
} from "../../src/agents/resource-policy.js";

function validResult(overrides = {}) {
  return {
    taskId: "task-1",
    invocationId: "task-1:ANALYST:1",
    role: "ANALYST",
    status: "COMPLETED",
    summary: "analysis complete",
    findings: [],
    decisions: [],
    artifacts: [],
    evidence: [],
    openQuestions: [],
    recommendations: [],
    limitations: [],
    ...overrides,
  };
}

test("AGENT_RESOURCE_LIMITS exposes the frozen defaults", () => {
  assert.deepEqual(AGENT_RESOURCE_LIMITS, {
    maxResultBytes: 65536,
    maxFindings: 100,
    maxDecisions: 50,
    maxArtifacts: 50,
    maxEvidence: 100,
    maxInvocations: 16,
    maxInvocationMs: 300000,
  });
  assert.equal(Object.isFrozen(AGENT_RESOURCE_LIMITS), true);
});

test("resolveResourceLimits returns frozen defaults when no overrides are given", () => {
  const limits = resolveResourceLimits();
  assert.deepEqual(limits, AGENT_RESOURCE_LIMITS);
  assert.equal(Object.isFrozen(limits), true);
  assert.notEqual(limits, AGENT_RESOURCE_LIMITS);
});

test("resolveResourceLimits merges and freezes overrides", () => {
  const limits = resolveResourceLimits({ maxFindings: 5, maxInvocationMs: 0 });
  assert.equal(limits.maxFindings, 5);
  assert.equal(limits.maxInvocationMs, 0);
  assert.equal(limits.maxResultBytes, 65536);
  assert.equal(Object.isFrozen(limits), true);
});

test("resolveResourceLimits rejects non-positive and non-integer limits", () => {
  for (const overrides of [
    { maxFindings: 0 },
    { maxResultBytes: -1 },
    { maxInvocations: 1.5 },
    { maxInvocationMs: -1 },
    { maxFindings: "10" },
  ]) {
    assert.throws(
      () => resolveResourceLimits(overrides),
      (error) => error instanceof RoleContractError && error.issues.length > 0,
      JSON.stringify(overrides),
    );
  }
});

test("resolveResourceLimits rejects unsupported keys", () => {
  assert.throws(
    () => resolveResourceLimits({ maxTokens: 10 }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes(
        "resourceLimits.maxTokens is not a supported limit",
      ),
  );
});

test("assertResultResources accepts a small valid result", () => {
  const result = validResult();
  assert.equal(assertResultResources(result), result);
});

test("assertResultResources rejects results exceeding maxResultBytes", () => {
  const result = validResult({ summary: "x".repeat(70000) });
  assert.throws(
    () => assertResultResources(result),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.some((issue) => issue.startsWith("result exceeds maxResultBytes")),
  );
});

test("assertResultResources rejects collections above their limits", () => {
  const cases = [
    ["maxFindings", "findings", 101],
    ["maxDecisions", "decisions", 51],
    ["maxArtifacts", "artifacts", 51],
    ["maxEvidence", "evidence", 101],
  ];
  for (const [limitKey, field, count] of cases) {
    const result = validResult({
      [field]: Array.from({ length: count }, (_, index) => `item-${index}`),
    });
    assert.throws(
      () => assertResultResources(result),
      (error) =>
        error instanceof RoleContractError &&
        error.issues.includes(
          `result.${field} exceeds ${limitKey} (${count} > ${AGENT_RESOURCE_LIMITS[limitKey]})`,
        ),
      field,
    );
  }
});

test("assertResultResources honours custom limits", () => {
  const limits = resolveResourceLimits({ maxFindings: 2, maxResultBytes: 200 });
  assert.throws(
    () =>
      assertResultResources(
        validResult({ findings: ["a", "b", "c"] }),
        limits,
      ),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("result.findings exceeds maxFindings (3 > 2)"),
  );
  assert.throws(
    () => assertResultResources(validResult(), limits),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.some((issue) => issue.startsWith("result exceeds maxResultBytes")),
  );
});
