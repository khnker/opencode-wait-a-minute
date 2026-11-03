import test from "node:test";
import assert from "node:assert/strict";

import {
  AgentTaskIntegrationError,
  applyAgentRun,
  buildTaskAgentInput,
  runConfiguredTaskAgentStep,
  runTaskAgentStep,
  shouldRunTaskAgentPass,
} from "../../src/execution/task-agent-run.js";
import {
  decideAgentLoopAction,
  decideNextAction,
} from "../../src/execution/task-loop.js";

const TASK_ID = "task-1";
const REVIEW_FINDING = {
  id: "R1",
  description: "Missing rate limit",
  severity: "HIGH",
  evidence: ["tests/auth.test.js"],
  correctiveAction: "Add a rate limit",
  criterionId: "AC1",
};

function baseTask(overrides = {}) {
  return {
    id: TASK_ID,
    objective: "Ship auth",
    outcomeContract: {
      objective: "Ship auth",
      acceptanceCriteria: [
        {
          id: "AC1",
          description: "Auth is enforced",
          mandatory: true,
          evidenceRequirements: { tests: ["unit"] },
        },
      ],
    },
    artifacts: ["src/auth.js"],
    evidence: [{ type: "test", path: "tests/auth.test.js", status: "pass" }],
    constraints: ["no breaking change"],
    requirements: [{ id: "req-1", title: "Auth", status: "done", evidence: ["unit"] }],
    ...overrides,
  };
}

function makeAdapter({ reviewVerdict = "ACCEPTED" } = {}) {
  const calls = [];
  return {
    calls,
    async invoke(request) {
      calls.push(request);
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
      };
      if (request.role === "REVIEWER") {
        result.review = {
          verdict: reviewVerdict,
          findings: reviewVerdict === "ACCEPTED" ? [] : [REVIEW_FINDING],
          limitations: [],
        };
      }
      return { result, metadata: { sessionID: `session-${request.invocationId}` } };
    },
  };
}

test("buildTaskAgentInput maps contract, artifacts, evidence and constraints", () => {
  const task = baseTask();
  const snapshot = JSON.parse(JSON.stringify(task));
  const input = buildTaskAgentInput(task);

  assert.equal(input.taskId, TASK_ID);
  assert.equal(input.objective, "Ship auth");
  assert.deepEqual(input.acceptanceCriteria, [
    {
      id: "AC1",
      description: "Auth is enforced",
      mandatory: true,
      evidenceRequirements: { tests: ["unit"] },
    },
  ]);
  assert.deepEqual(input.artifacts, ["src/auth.js"]);
  assert.deepEqual(input.evidence, ["tests/auth.test.js", "unit"]);
  assert.deepEqual(input.constraints, ["no breaking change"]);
  assert.deepEqual(input.priorFindings, []);
  assert.deepEqual(task, snapshot);
});

test("buildTaskAgentInput synthesizes a criterion when none is declared", () => {
  const input = buildTaskAgentInput({ id: "task-2", objective: "Fix login" });

  assert.deepEqual(input.acceptanceCriteria, [
    { id: "task-outcome", description: "Fix login", mandatory: true },
  ]);
});

test("buildTaskAgentInput rejects tasks without id or objective", () => {
  assert.throws(() => buildTaskAgentInput({ objective: "No id" }), AgentTaskIntegrationError);
  assert.throws(() => buildTaskAgentInput({ id: "no-objective" }), AgentTaskIntegrationError);
});

test("buildTaskAgentInput carries prior findings from an earlier agent run", () => {
  const task = baseTask({
    agentRun: {
      results: [{ result: { findings: [REVIEW_FINDING] } }],
    },
  });

  assert.deepEqual(buildTaskAgentInput(task).priorFindings, [REVIEW_FINDING]);
});

test("applyAgentRun stores the latest run and caps history without mutating input", () => {
  const outcome = {
    status: "COMPLETED",
    verdict: "ACCEPTED",
    stoppedAt: null,
    exhausted: false,
    cycles: { revisions: 0, replans: 0 },
    results: [],
    handoffs: [],
  };

  let task = baseTask();
  const originalHistory = task.agentHistory;
  for (let index = 1; index <= 6; index += 1) {
    task = applyAgentRun(task, outcome, { now: index, maxHistory: 3 });
  }

  assert.equal(task.agentRun.status, "COMPLETED");
  assert.equal(task.agentHistory.length, 3);
  assert.deepEqual(
    task.agentHistory.map((entry) => entry.updatedAt),
    [4, 5, 6],
  );
  assert.equal(originalHistory, undefined);
  assert.equal(baseTask().agentRun, undefined);
});

test("applyAgentRun validates the history cap", () => {
  assert.throws(
    () => applyAgentRun(baseTask(), { status: "COMPLETED" }, { maxHistory: -1 }),
    AgentTaskIntegrationError,
  );
});

test("decideAgentLoopAction maps terminal agent outcomes", () => {
  assert.deepEqual(decideAgentLoopAction({ status: "COMPLETED", verdict: "ACCEPTED" }), {
    decision: "VERIFY",
    reason: "agent-review-accepted",
  });
  assert.deepEqual(decideAgentLoopAction({ status: "FAILED" }), {
    decision: "BLOCK",
    reason: "agent-failed",
  });
  assert.deepEqual(decideAgentLoopAction({ status: "BLOCKED" }), {
    decision: "WAIT_USER",
    reason: "agent-blocked",
  });
  assert.deepEqual(decideAgentLoopAction({ status: "NEEDS_INPUT" }), {
    decision: "WAIT_USER",
    reason: "agent-needs-input",
  });
  assert.deepEqual(
    decideAgentLoopAction({ status: "REVISION_REQUIRED", verdict: "REVISION_REQUIRED", exhausted: true }),
    { decision: "WAIT_USER", reason: "agent-revision-exhausted" },
  );
  assert.deepEqual(
    decideAgentLoopAction({ status: "REPLAN_REQUIRED", verdict: "REPLAN_REQUIRED", exhausted: true }),
    { decision: "WAIT_USER", reason: "agent-replan-exhausted" },
  );
  assert.equal(decideAgentLoopAction(null), null);
  assert.deepEqual(
    decideAgentLoopAction({ status: "COMPLETED", verdict: "ACCEPTED", exhausted: true }),
    { decision: "WAIT_USER", reason: "agent-revision-exhausted" },
  );
});

test("decideAgentLoopAction surfaces a non-exhausted reviewer rejection", () => {
  assert.deepEqual(
    decideAgentLoopAction({ status: "REVISION_REQUIRED", verdict: "REVISION_REQUIRED" }),
    { decision: "CONTINUE", reason: "agent-revision-required" },
  );
  assert.deepEqual(
    decideAgentLoopAction({ status: "REPLAN_REQUIRED", verdict: "REPLAN_REQUIRED" }),
    { decision: "REPLAN", reason: "agent-replan-required" },
  );
});

test("decideNextAction accepts an agent outcome but budget still wins", () => {
  const base = {
    task: { state: "EXECUTING" },
    completionGate: { ok: false, pending: ["AC1"] },
  };
  const accepted = { status: "COMPLETED", verdict: "ACCEPTED" };

  assert.equal(decideNextAction({ ...base, agent: accepted }).decision, "VERIFY");
  assert.equal(
    decideNextAction({ ...base, agent: { status: "FAILED" } }).decision,
    "BLOCK",
  );
  assert.equal(
    decideNextAction({ ...base, budget: { exhausted: true }, agent: accepted }).decision,
    "STOP_BUDGET",
  );
});

test("runTaskAgentStep runs accepted orchestration and opts into persistence", async () => {
  const adapter = makeAdapter();
  const task = baseTask();
  const persisted = [];
  const result = await runTaskAgentStep({
    task,
    adapter,
    now: 42,
    persist: async (updated, outcome) => persisted.push({ updated, outcome }),
  });

  assert.equal(adapter.calls.length, 4);
  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "BUILDER", "REVIEWER"],
  );
  assert.deepEqual(adapter.calls[0].acceptanceCriteria, task.outcomeContract.acceptanceCriteria);
  assert.equal(result.outcome.status, "COMPLETED");
  assert.equal(result.outcome.verdict, "ACCEPTED");
  assert.deepEqual(result.decision, {
    decision: "VERIFY",
    reason: "agent-review-accepted",
  });
  assert.equal(result.task.agentRun.status, "COMPLETED");
  assert.equal(result.task.agentRun.updatedAt, 42);
  assert.equal(result.task.agentHistory.length, 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].updated, result.task);
  assert.equal(task.agentRun, undefined);
});

test("runTaskAgentStep surfaces exhausted revision as WAIT_USER", async () => {
  const adapter = makeAdapter({ reviewVerdict: "REVISION_REQUIRED" });
  const result = await runTaskAgentStep({
    task: baseTask(),
    adapter,
    maxRevisionCycles: 0,
  });

  assert.equal(result.outcome.status, "REVISION_REQUIRED");
  assert.equal(result.outcome.exhausted, true);
  assert.deepEqual(result.decision, {
    decision: "WAIT_USER",
    reason: "agent-revision-exhausted",
  });
});

test("runTaskAgentStep rejects a non-function persistence callback", async () => {
  await assert.rejects(
    runTaskAgentStep({ task: baseTask(), adapter: makeAdapter(), persist: "no" }),
    AgentTaskIntegrationError,
  );
});

test("shouldRunTaskAgentPass skips terminal outcomes and allows retries", () => {
  assert.equal(shouldRunTaskAgentPass(baseTask()), true);
  assert.equal(
    shouldRunTaskAgentPass({ ...baseTask(), agentRun: { status: "COMPLETED", verdict: "ACCEPTED" } }),
    false,
  );
  assert.equal(
    shouldRunTaskAgentPass({ ...baseTask(), agentRun: { status: "REVISION_REQUIRED", exhausted: true } }),
    false,
  );
  assert.equal(
    shouldRunTaskAgentPass({ ...baseTask(), agentRun: { status: "NEEDS_INPUT" } }),
    false,
  );
  assert.equal(
    shouldRunTaskAgentPass({ ...baseTask(), agentRun: { status: "FAILED" } }),
    false,
  );
  assert.equal(
    shouldRunTaskAgentPass({ ...baseTask(), agentRun: { status: "COMPLETED", verdict: "REVISION_REQUIRED" } }),
    true,
  );
});

test("runConfiguredTaskAgentStep stays inert when agents are disabled", async () => {
  const adapter = makeAdapter();
  const persisted = [];
  const result = await runConfiguredTaskAgentStep({
    task: baseTask(),
    adapter,
    config: { enabled: false },
    persist: (task) => persisted.push(task),
  });

  assert.equal(result, null);
  assert.equal(adapter.calls.length, 0);
  assert.deepEqual(persisted, []);
});

test("runTaskAgentStep supplies taskId for a persisted snapshot without id", async () => {
  const task = baseTask();
  delete task.id;
  const adapter = makeAdapter();
  const result = await runTaskAgentStep({ task, taskId: TASK_ID, adapter });

  assert.ok(adapter.calls.length > 0);
  assert.ok(adapter.calls.every((call) => call.taskId === TASK_ID));
  assert.equal(result.outcome.status, "COMPLETED");
  assert.equal(result.outcome.verdict, "ACCEPTED");
});

test("runConfiguredTaskAgentStep applies limits and persists the updated task", async () => {
  let persisted = null;
  const result = await runConfiguredTaskAgentStep({
    task: baseTask(),
    adapter: makeAdapter(),
    config: { enabled: true, maxRevisionCycles: 0, maxReplanCycles: 0, maxHistory: 1 },
    persist: (updated) => {
      persisted = updated;
    },
  });

  assert.equal(result.outcome.status, "COMPLETED");
  assert.equal(result.outcome.verdict, "ACCEPTED");
  assert.equal(result.task.agentHistory.length, 1);
  assert.equal(persisted.taskId ?? persisted.id, TASK_ID);
  assert.equal(baseTask().agentRun, undefined);
});

test("runConfiguredTaskAgentStep skips accepted terminal runs", async () => {
  const adapter = makeAdapter();
  const accepted = {
    ...baseTask(),
    agentRun: { status: "COMPLETED", verdict: "ACCEPTED" },
  };
  const result = await runConfiguredTaskAgentStep({
    task: accepted,
    adapter,
    config: { enabled: true },
  });

  assert.equal(result, null);
  assert.equal(adapter.calls.length, 0);
});

test("buildTaskAgentInput collects reviewArtifacts, diff and patch", () => {
  const input = buildTaskAgentInput(
    baseTask({
      reviewArtifacts: [{ ref: "meta", content: "context" }],
      diff: { path: "src/a.js", diff: "+a" },
      patch: "--- a\n+++ b",
    }),
  );

  assert.deepEqual(input.reviewArtifacts, [
    { ref: "meta", content: "context" },
    { ref: "src/a.js", content: "+a" },
    { ref: "patch", content: "--- a\n+++ b" },
  ]);
});

test("buildTaskAgentInput defaults to an empty reviewArtifacts array", () => {
  assert.deepEqual(buildTaskAgentInput(baseTask()).reviewArtifacts, []);
});

test("routes task.diff into the reviewer request only", async () => {
  const adapter = makeAdapter();
  const diff = "diff --git a/src/auth.js b/src/auth.js\n+rate limit";

  const result = await runTaskAgentStep({
    task: baseTask({ diff }),
    adapter,
  });

  const reviewer = adapter.calls.find((call) => call.role === "REVIEWER");
  assert.deepEqual(reviewer.input.reviewArtifacts, [
    { ref: "diff", content: diff },
  ]);
  for (const call of adapter.calls.filter((entry) => entry.role !== "REVIEWER")) {
    assert.equal("reviewArtifacts" in call.input, false);
  }
  assert.equal(result.outcome.status, "COMPLETED");
});
