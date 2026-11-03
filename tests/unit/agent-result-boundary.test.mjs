import test from "node:test";
import assert from "node:assert/strict";

import { RoleContractError } from "../../src/agents/role-contracts.js";
import {
  assertInvocationResult,
  assertResultIdentity,
  validateResultIdentity,
} from "../../src/agents/result-boundary.js";
import {
  AgentOrchestrationError,
  runAgentFeedbackOrchestration,
  runAgentOrchestration,
} from "../../src/agents/orchestrator.js";
import { resolveResourceLimits } from "../../src/agents/resource-policy.js";

const CRITERIA = [
  {
    id: "AC1",
    description: "The change is correct",
    mandatory: true,
    evidenceRequirements: { tests: ["unit"] },
  },
];

function requestFor(role = "ANALYST") {
  return {
    taskId: "task-1",
    invocationId: `task-1:${role}:1`,
    role,
    objective: `Perform the ${role} pass`,
    acceptanceCriteria: CRITERIA,
    input: { artifacts: [], evidence: [], constraints: [], priorFindings: [] },
    expectedOutput: ["summary"],
  };
}

function resultFor(request, overrides = {}) {
  const result = {
    taskId: request.taskId,
    invocationId: request.invocationId,
    role: request.role,
    status: "COMPLETED",
    summary: `${request.role} completed`,
    findings: [],
    decisions: [],
    artifacts: [],
    evidence: [],
    openQuestions: [],
    recommendations: [],
    limitations: [],
    ...overrides,
  };
  if (request.role === "REVIEWER" && !("review" in overrides)) {
    result.review = { verdict: "ACCEPTED", findings: [], limitations: [] };
  }
  return result;
}

function fakeAdapter(makeResult) {
  const calls = [];
  return {
    calls,
    async invoke(request) {
      calls.push(request);
      return {
        result: makeResult(request),
        metadata: { sessionID: `ses-${request.role}` },
      };
    },
  };
}

function baseOptions(adapter, overrides = {}) {
  return {
    taskId: "task-1",
    objective: "harden authentication",
    acceptanceCriteria: CRITERIA,
    artifacts: ["src/auth.js"],
    evidence: ["ev-base"],
    constraints: ["keep backward compatibility"],
    adapter,
    ...overrides,
  };
}

test("validateResultIdentity collects every identity mismatch", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, {
    taskId: "other-task",
    invocationId: "other-invocation",
    role: "BUILDER",
  });

  assert.deepEqual(validateResultIdentity(result, request), [
    "taskId does not match the request",
    "invocationId does not match the request",
    "role does not match the request",
  ]);
  assert.deepEqual(validateResultIdentity(resultFor(request), request), []);
});

test("assertResultIdentity throws RoleContractError with the collected issues", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, { taskId: "other-task" });

  assert.throws(
    () => assertResultIdentity(result, request),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("taskId does not match the request"),
  );
});

test("assertInvocationResult returns the original result and metadata unchanged", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, { artifacts: ["src/a.js"], evidence: ["ev-a"] });
  const metadata = { sessionID: "ses-1" };
  const snapshot = structuredClone(result);

  const validated = assertInvocationResult({ request, invocation: { result, metadata } });

  assert.equal(validated.result, result);
  assert.equal(validated.metadata, metadata);
  assert.deepEqual(result, snapshot);
});

test("assertInvocationResult rejects decisions for a role without proposeDecisions", () => {
  const request = requestFor("BUILDER");
  const result = resultFor(request, {
    decisions: [{ id: "D1", description: "Use a guard", rationale: "Prevents drift" }],
  });

  assert.throws(
    () => assertInvocationResult({ request, invocation: { result } }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("role BUILDER cannot propose decisions"),
  );
});

test("assertInvocationResult rejects review for a non-reviewer role", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, {
    review: { verdict: "ACCEPTED", findings: [], limitations: [] },
  });

  assert.throws(
    () => assertInvocationResult({ request, invocation: { result } }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("review is only allowed for the reviewer role"),
  );
});

test("artifacts and evidence are not capability claims", () => {
  const request = requestFor("BUILDER");
  const result = resultFor(request, {
    artifacts: ["src/b.js"],
    evidence: ["ev-b"],
  });

  const validated = assertInvocationResult({ request, invocation: { result } });
  assert.equal(validated.result, result);
});

test("assertInvocationResult still rejects unknown top-level keys", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, { extra: true });

  assert.throws(
    () => assertInvocationResult({ request, invocation: { result } }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("extra is not part of the contract"),
  );
});

test("orchestrator wraps a mismatched fake-adapter result with cause and context", async () => {
  const artifacts = ["src/auth.js"];
  const adapter = fakeAdapter((request) =>
    resultFor(request, { taskId: "other-task" }),
  );

  await assert.rejects(
    () => runAgentOrchestration(baseOptions(adapter, { artifacts })),
    (error) => {
      assert.ok(error instanceof AgentOrchestrationError);
      assert.ok(error.cause instanceof RoleContractError);
      assert.match(error.message, /ANALYST/);
      assert.match(error.message, /task-1:ANALYST:1/);
      return true;
    },
  );
  assert.equal(adapter.calls.length, 1);
  assert.deepEqual(artifacts, ["src/auth.js"]);
});

test("orchestrator rejects capability claims from an adapter that bypasses adapter validation", async () => {
  const findings = ["ev-base"];
  const adapter = fakeAdapter((request) => {
    if (request.role === "BUILDER") {
      return resultFor(request, {
        decisions: [
          { id: "D1", description: "Use a guard", rationale: "Prevents drift" },
        ],
      });
    }
    return resultFor(request);
  });

  await assert.rejects(
    () => runAgentOrchestration(baseOptions(adapter, { evidence: findings })),
    (error) => {
      assert.ok(error instanceof AgentOrchestrationError);
      assert.ok(error.cause instanceof RoleContractError);
      assert.match(error.message, /BUILDER/);
      assert.match(error.message, /task-1:BUILDER:1/);
      return true;
    },
  );
  assert.deepEqual(findings, ["ev-base"]);
});

test("feedback orchestration enforces the same result boundary", async () => {
  const adapter = fakeAdapter((request) =>
    resultFor(request, { invocationId: "other-invocation" }),
  );

  await assert.rejects(
    () => runAgentFeedbackOrchestration(baseOptions(adapter)),
    (error) =>
      error instanceof AgentOrchestrationError &&
      error.cause instanceof RoleContractError,
  );
  assert.equal(adapter.calls.length, 1);
});

test("a valid result flows through unchanged into results", async () => {
  let firstResult;
  const adapter = fakeAdapter((request) => {
    firstResult = resultFor(request, { status: "BLOCKED" });
    return firstResult;
  });

  const outcome = await runAgentOrchestration(baseOptions(adapter));

  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].result, firstResult);
  assert.equal(outcome.results[0].metadata.sessionID, "ses-ANALYST");
  assert.equal(outcome.handoffs.length, 0);
});

test("assertInvocationResult rejects a missing result", () => {
  const request = requestFor("ANALYST");

  assert.throws(
    () => assertInvocationResult({ request, invocation: { metadata: {} } }),
    (error) =>
      error instanceof RoleContractError && error.issues.includes("result is required"),
  );
});

test("orchestrator rejects review from a non-reviewer adapter result", async () => {
  const adapter = fakeAdapter((request) => {
    if (request.role === "ARCHITECT") {
      return resultFor(request, {
        review: { verdict: "ACCEPTED", findings: [], limitations: [] },
      });
    }
    return resultFor(request);
  });

  await assert.rejects(
    () => runAgentOrchestration(baseOptions(adapter)),
    (error) =>
      error instanceof AgentOrchestrationError &&
      error.cause instanceof RoleContractError,
  );
});

test("a rejected result stops the pipeline before later roles run", async () => {
  const adapter = fakeAdapter((request) => {
    if (request.role === "BUILDER") {
      return resultFor(request, { role: "REVIEWER" });
    }
    return resultFor(request);
  });

  await assert.rejects(() => runAgentOrchestration(baseOptions(adapter)));
  assert.deepEqual(
    adapter.calls.map((request) => request.role),
    ["ANALYST", "ARCHITECT", "BUILDER"],
  );
});

test("assertInvocationResult rejects an oversized result", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, { summary: "x".repeat(70000) });

  assert.throws(
    () => assertInvocationResult({ request, invocation: { result } }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.some((issue) =>
        issue.startsWith("result exceeds maxResultBytes"),
      ),
  );
});

test("assertInvocationResult applies custom resource limits", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request, { artifacts: ["a.js", "b.js"] });
  const resourceLimits = resolveResourceLimits({ maxArtifacts: 1 });

  assert.throws(
    () => assertInvocationResult({ request, invocation: { result }, resourceLimits }),
    (error) =>
      error instanceof RoleContractError &&
      error.issues.includes("result.artifacts exceeds maxArtifacts (2 > 1)"),
  );
});

test("assertInvocationResult accepts a small result with default limits", () => {
  const request = requestFor("ANALYST");
  const result = resultFor(request);

  assert.deepEqual(
    assertInvocationResult({ request, invocation: { result } }).result,
    result,
  );
});
