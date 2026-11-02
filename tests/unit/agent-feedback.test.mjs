import test from "node:test";
import assert from "node:assert/strict";

import {
  runAgentFeedbackOrchestration,
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

function createAdapter(sequences = {}) {
  const calls = [];
  const indexes = {};
  return {
    calls,
    async invoke(request) {
      calls.push(request);
      const sequence = sequences[request.role] ?? [{}];
      const index = indexes[request.role] ?? 0;
      indexes[request.role] = index + 1;
      const override = sequence[Math.min(index, sequence.length - 1)];
      const resolved =
        typeof override === "function" ? override(request) : override;
      return {
        result: makeResult(request.role, {
          ...resolved,
          taskId: request.taskId,
          invocationId: request.invocationId,
        }),
        metadata: { sessionID: `ses-${request.role}-${index + 1}` },
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

const reviewFinding = {
  severity: "HIGH",
  description: "Missing test coverage",
  evidence: ["ev-review"],
  correctiveAction: "Add the missing test",
  criterionId: "AC1",
};

const revision = {
  review: {
    verdict: "REVISION_REQUIRED",
    findings: [reviewFinding],
    limitations: [],
  },
};

const replan = {
  review: {
    verdict: "REPLAN_REQUIRED",
    findings: [
      {
        severity: "CRITICAL",
        description: "The design cannot be implemented",
        evidence: ["ev-replan"],
        correctiveAction: "Choose another design",
      },
    ],
    limitations: [],
  },
};

const accepted = {
  review: { verdict: "ACCEPTED", findings: [], limitations: [] },
};

test("reruns Builder with review findings and accepts the fix", async () => {
  const adapter = createAdapter({
    BUILDER: [{}, { artifacts: ["src/auth-fix.js"], evidence: ["ev-fix"] }],
    REVIEWER: [revision, accepted],
  });

  const outcome = await runAgentFeedbackOrchestration(baseOptions(adapter));

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "BUILDER", "REVIEWER", "BUILDER", "REVIEWER"],
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
  assert.equal(outcome.results.length, 6);
  assert.deepEqual(outcome.cycles, { revisions: 1, replans: 0 });
  assert.equal(outcome.exhausted, false);

  const secondBuilder = adapter.calls[4];
  const secondReviewer = adapter.calls[5];
  assert.equal(secondBuilder.invocationId, `${TASK_ID}:BUILDER:2`);
  assert.equal(secondReviewer.invocationId, `${TASK_ID}:REVIEWER:2`);
  assert.ok(
    secondBuilder.input.constraints.some((line) =>
      line.includes(
        "Review finding (HIGH, AC1): Missing test coverage | corrective action: Add the missing test | evidence: ev-review",
      ),
    ),
  );
  assert.ok(secondReviewer.input.evidence.includes("ev-fix"));
  assert.ok(
    secondReviewer.input.constraints.some((line) =>
      line.includes("corrective action: Add the missing test"),
    ),
  );

  const feedback = outcome.handoffs.find((handoff) => handoff.kind === "revision");
  assert.equal(feedback.from, "REVIEWER");
  assert.equal(feedback.to, "BUILDER");
  assert.deepEqual(feedback.reviewFindings, [reviewFinding]);
});

test("stops after the revision limit is exhausted", async () => {
  const adapter = createAdapter({ REVIEWER: [revision] });

  const outcome = await runAgentFeedbackOrchestration(
    baseOptions(adapter, { maxRevisionCycles: 1 }),
  );

  assert.equal(outcome.status, "REVISION_REQUIRED");
  assert.equal(outcome.verdict, "REVISION_REQUIRED");
  assert.equal(outcome.stoppedAt, "REVIEWER");
  assert.equal(outcome.results.length, 6);
  assert.equal(adapter.calls.length, 6);
  assert.equal(outcome.exhausted, true);
  assert.deepEqual(outcome.cycles, { revisions: 1, replans: 0 });
});

test("replans the architecture and discards superseded decisions", async () => {
  const adapter = createAdapter({
    ARCHITECT: [
      {
        decisions: [
          {
            id: "D1",
            description: "Use middleware",
            rationale: "centralize auth",
          },
        ],
      },
      {
        decisions: [
          {
            id: "D2",
            description: "Use a route guard",
            rationale: "replace the invalid design",
          },
        ],
      },
    ],
    REVIEWER: [replan, accepted],
  });

  const outcome = await runAgentFeedbackOrchestration(
    baseOptions(adapter, { maxReplanCycles: 1 }),
  );

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "BUILDER", "REVIEWER", "ARCHITECT", "BUILDER", "REVIEWER"],
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
  assert.deepEqual(outcome.cycles, { revisions: 0, replans: 1 });

  const secondArchitect = adapter.calls[4];
  const secondBuilder = adapter.calls[5];
  assert.equal(secondArchitect.invocationId, `${TASK_ID}:ARCHITECT:2`);
  assert.ok(
    secondArchitect.input.constraints.some((line) =>
      line.includes("corrective action: Choose another design"),
    ),
  );
  assert.ok(
    !secondArchitect.input.constraints.some((line) =>
      line.includes("Decision D1"),
    ),
  );
  assert.ok(
    secondBuilder.input.constraints.some((line) => line.includes("Decision D2")),
  );
  assert.ok(
    !secondBuilder.input.constraints.some((line) => line.includes("Decision D1")),
  );

  const feedback = outcome.handoffs.find((handoff) => handoff.kind === "replan");
  assert.equal(feedback.from, "REVIEWER");
  assert.equal(feedback.to, "ARCHITECT");
  assert.equal(feedback.reviewFindings.length, 1);
});

test("stops after the replan limit is exhausted", async () => {
  const adapter = createAdapter({ REVIEWER: [replan] });

  const outcome = await runAgentFeedbackOrchestration(
    baseOptions(adapter, { maxReplanCycles: 0 }),
  );

  assert.equal(outcome.status, "REPLAN_REQUIRED");
  assert.equal(outcome.stoppedAt, "REVIEWER");
  assert.equal(adapter.calls.length, 4);
  assert.equal(outcome.exhausted, true);
  assert.deepEqual(outcome.cycles, { revisions: 0, replans: 0 });
});

test("handles a revision after a replan", async () => {
  const adapter = createAdapter({
    ARCHITECT: [
      {
        decisions: [
          {
            id: "D1",
            description: "Use middleware",
            rationale: "centralize auth",
          },
        ],
      },
      {
        decisions: [
          {
            id: "D2",
            description: "Use a route guard",
            rationale: "replace the invalid design",
          },
        ],
      },
    ],
    BUILDER: [
      {},
      {},
      { artifacts: ["src/auth-fix.js"], evidence: ["ev-fix"] },
    ],
    REVIEWER: [replan, revision, accepted],
  });

  const outcome = await runAgentFeedbackOrchestration(
    baseOptions(adapter, { maxRevisionCycles: 1, maxReplanCycles: 1 }),
  );

  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
  assert.equal(outcome.results.length, 9);
  assert.deepEqual(outcome.cycles, { revisions: 1, replans: 1 });
  assert.equal(adapter.calls.length, 9);

  const thirdBuilder = adapter.calls[7];
  assert.ok(
    thirdBuilder.input.constraints.some((line) => line.includes("Decision D2")),
  );
  assert.ok(
    thirdBuilder.input.constraints.some((line) =>
      line.includes("corrective action: Add the missing test"),
    ),
  );
});

test("stops when the Builder blocks during a revision", async () => {
  const adapter = createAdapter({
    BUILDER: [{}, { status: "BLOCKED" }],
    REVIEWER: [revision],
  });

  const outcome = await runAgentFeedbackOrchestration(
    baseOptions(adapter, { maxRevisionCycles: 2 }),
  );

  assert.equal(outcome.status, "BLOCKED");
  assert.equal(outcome.stoppedAt, "BUILDER");
  assert.equal(outcome.results.length, 5);
  assert.equal(adapter.calls.length, 5);
  assert.equal(outcome.exhausted, false);
});

test("fails loud on invalid feedback limits", async () => {
  const adapter = createAdapter();

  await assert.rejects(
    runAgentFeedbackOrchestration(
      baseOptions(adapter, { maxRevisionCycles: -1 }),
    ),
    /maxRevisionCycles must be a non-negative integer/,
  );
});
