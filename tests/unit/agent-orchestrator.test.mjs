import test from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_PIPELINE,
  AgentOrchestrationError,
  runAgentOrchestration,
} from "../../src/agents/orchestrator.js";

const TASK_ID = "task-1";
const CRITERIA = [
  {
    id: "AC1",
    description: "Auth is enforced",
    mandatory: true,
    evidenceRequirements: { tests: ["unit"] },
  },
];

function makeResult(role, overrides = {}) {
  const result = {
    taskId: TASK_ID,
    invocationId: `${TASK_ID}:${role}:1`,
    role,
    status: "COMPLETED",
    summary: `${role} completed`,
    findings: [],
    decisions: [],
    artifacts: [],
    evidence: [],
    openQuestions: [],
    recommendations: [],
    limitations: [],
  };
  if (role === "REVIEWER") {
    result.review = { verdict: "ACCEPTED", findings: [], limitations: [] };
  }
  return { ...result, ...overrides };
}

function createAdapter(overridesByRole = {}) {
  const calls = [];
  return {
    calls,
    async invoke(request) {
      calls.push(request);
      const override = overridesByRole[request.role];
      const overrides =
        typeof override === "function" ? override(request) : (override ?? {});
      return {
        result: makeResult(request.role, {
          ...overrides,
          taskId: request.taskId,
          invocationId: request.invocationId,
        }),
        metadata: { sessionID: `ses-${request.role}` },
      };
    },
  };
}

function baseOptions(adapter, overrides = {}) {
  return {
    taskId: TASK_ID,
    objective: "harden authentication",
    acceptanceCriteria: CRITERIA,
    artifacts: ["src/auth.js"],
    evidence: ["ev-base"],
    constraints: ["keep backward compatibility"],
    adapter,
    ...overrides,
  };
}

const analystFinding = {
  id: "F1",
  description: "Missing rate limit on login",
  severity: "HIGH",
  evidence: ["ev-a"],
  criterionId: "AC1",
};

test("runs the four roles once in deterministic order", async () => {
  const adapter = createAdapter();

  const outcome = await runAgentOrchestration(baseOptions(adapter));

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    AGENT_PIPELINE,
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
  assert.equal(outcome.stoppedAt, null);
  assert.equal(outcome.results.length, 4);
  assert.deepEqual(
    outcome.results.map((entry) => entry.invocationId),
    AGENT_PIPELINE.map((role) => `${TASK_ID}:${role}:1`),
  );
  assert.deepEqual(
    outcome.context.map((entry) => entry.role),
    AGENT_PIPELINE,
  );
});

test("uses role-specific objectives and expected output", async () => {
  const adapter = createAdapter();

  await runAgentOrchestration(baseOptions(adapter));

  assert.match(adapter.calls[0].objective, /^Analyze the task/);
  assert.match(adapter.calls[1].objective, /^Design the implementation strategy/);
  assert.match(adapter.calls[2].objective, /^Implement the approved strategy/);
  assert.match(adapter.calls[3].objective, /^Review the implementation/);
  assert.deepEqual(adapter.calls[0].expectedOutput, [
    "findings",
    "openQuestions",
    "evidence",
    "limitations",
  ]);
  assert.deepEqual(adapter.calls[3].expectedOutput, [
    "review.verdict",
    "review.findings",
    "review.limitations",
  ]);
});

test("hands findings, decisions, artifacts and evidence to later roles", async () => {
  const adapter = createAdapter({
    ANALYST: {
      findings: [analystFinding],
      decisions: [
        {
          id: "AD1",
          description: "Investigate middleware",
          rationale: "centralized auth",
        },
      ],
      openQuestions: ["Which identity provider is canonical?"],
      evidence: ["ev-a"],
      artifacts: ["docs/analysis.md"],
    },
    ARCHITECT: {
      decisions: [
        {
          id: "D1",
          description: "Use an auth middleware",
          rationale: "one enforcement point",
        },
      ],
      artifacts: ["docs/design.md"],
    },
    BUILDER: {
      artifacts: ["src/auth.js"],
      evidence: ["ev-build"],
    },
  });

  const outcome = await runAgentOrchestration(baseOptions(adapter));
  const architect = adapter.calls.find((call) => call.role === "ARCHITECT");
  const builder = adapter.calls.find((call) => call.role === "BUILDER");
  const reviewer = adapter.calls.find((call) => call.role === "REVIEWER");

  assert.equal(architect.input.priorFindings[0].id, "F1");
  assert.ok(
    architect.input.constraints.some((line) =>
      line.includes("Decision AD1: Investigate middleware"),
    ),
  );
  assert.ok(
    architect.input.constraints.includes(
      "Open question: Which identity provider is canonical?",
    ),
  );

  assert.ok(builder.input.priorFindings.some((finding) => finding.id === "F1"));
  assert.ok(
    builder.input.constraints.some((line) =>
      line.includes("Decision D1: Use an auth middleware"),
    ),
  );

  assert.ok(reviewer.input.artifacts.includes("src/auth.js"));
  assert.ok(reviewer.input.evidence.includes("ev-build"));
  assert.ok(
    reviewer.input.constraints.some((line) =>
      line.includes("Decision D1: Use an auth middleware"),
    ),
  );
  assert.equal(outcome.handoffs.length, 3);
  assert.deepEqual(
    outcome.handoffs.map((handoff) => [handoff.from, handoff.to]),
    [
      ["ANALYST", "ARCHITECT"],
      ["ARCHITECT", "BUILDER"],
      ["BUILDER", "REVIEWER"],
    ],
  );
});

test("stops on blocked roles without invoking later roles", async () => {
  const cases = [
    ["ANALYST", 1],
    ["ARCHITECT", 2],
    ["BUILDER", 3],
  ];

  for (const [role, expectedCalls] of cases) {
    const adapter = createAdapter({ [role]: { status: "BLOCKED" } });
    const outcome = await runAgentOrchestration(baseOptions(adapter));

    assert.equal(outcome.status, "BLOCKED");
    assert.equal(outcome.stoppedAt, role);
    assert.equal(outcome.results.length, expectedCalls);
    assert.equal(adapter.calls.length, expectedCalls);
  }
});

test("stops on needs-input and failed roles", async () => {
  for (const status of ["NEEDS_INPUT", "FAILED"]) {
    const adapter = createAdapter({ ARCHITECT: { status } });
    const outcome = await runAgentOrchestration(baseOptions(adapter));

    assert.equal(outcome.status, status);
    assert.equal(outcome.stoppedAt, "ARCHITECT");
    assert.equal(adapter.calls.length, 2);
  }
});

test("stops on a reviewer revision verdict", async () => {
  const adapter = createAdapter({
    REVIEWER: {
      review: {
        verdict: "REVISION_REQUIRED",
        findings: [
          {
            id: "RF1",
            severity: "HIGH",
            description: "Missing test coverage",
            evidence: ["ev-review"],
            correctiveAction: "Add the missing test",
          },
        ],
        limitations: [],
      },
    },
  });

  const outcome = await runAgentOrchestration(baseOptions(adapter));

  assert.equal(outcome.status, "REVISION_REQUIRED");
  assert.equal(outcome.verdict, "REVISION_REQUIRED");
  assert.equal(outcome.stoppedAt, "REVIEWER");
  assert.equal(outcome.results.length, 4);
  assert.equal(adapter.calls.length, 4);
});

test("stops on a reviewer replan verdict", async () => {
  const adapter = createAdapter({
    REVIEWER: {
      review: {
        verdict: "REPLAN_REQUIRED",
        findings: [
          {
            id: "RF2",
            severity: "CRITICAL",
            description: "Design is invalid",
            evidence: ["ev-review"],
            correctiveAction: "Replan the design",
          },
        ],
        limitations: [],
      },
    },
  });

  const outcome = await runAgentOrchestration(baseOptions(adapter));

  assert.equal(outcome.status, "REPLAN_REQUIRED");
  assert.equal(outcome.verdict, "REPLAN_REQUIRED");
  assert.equal(adapter.calls.length, 4);
});

test("propagates adapter failures without retrying", async () => {
  const adapter = {
    calls: 0,
    async invoke() {
      this.calls += 1;
      throw new Error("session unavailable");
    },
  };

  await assert.rejects(
    runAgentOrchestration(baseOptions(adapter)),
    /session unavailable/,
  );
  assert.equal(adapter.calls, 1);
});

test("does not mutate caller-owned arrays or results", async () => {
  const adapter = createAdapter({
    ANALYST: { findings: [analystFinding], evidence: ["ev-a"] },
  });
  const options = baseOptions(adapter);
  const before = structuredClone({
    artifacts: options.artifacts,
    evidence: options.evidence,
    constraints: options.constraints,
  });

  await runAgentOrchestration(options);

  assert.deepEqual(
    {
      artifacts: options.artifacts,
      evidence: options.evidence,
      constraints: options.constraints,
    },
    before,
  );
});

test("fails loud on invalid orchestration input", async () => {
  await assert.rejects(
    runAgentOrchestration({ taskId: "", objective: "", acceptanceCriteria: [] }),
    (error) => {
      assert.ok(error instanceof AgentOrchestrationError);
      assert.ok(error.issues.includes("taskId must be a non-empty string"));
      assert.ok(error.issues.includes("objective must be a non-empty string"));
      assert.ok(error.issues.includes("adapter.invoke must be a function"));
      return true;
    },
  );
});

test("fails loud when the context selector returns an invalid selection", async () => {
  const adapter = createAdapter();

  await assert.rejects(
    runAgentOrchestration(
      baseOptions(adapter, { contextSelector: () => ({ input: {} }) }),
    ),
    /invalid selection/,
  );
  assert.equal(adapter.calls.length, 0);
});
