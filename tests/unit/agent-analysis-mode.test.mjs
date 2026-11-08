import test from "node:test";
import assert from "node:assert/strict";

import { runAgentFeedbackOrchestration } from "../../src/agents/orchestrator.js";

const TASK_ID = "task-analysis";
const CRITERIA = [
  {
    id: "AC1",
    description: "Analysis produces findings",
    mandatory: true,
    evidenceRequirements: { tests: ["unit"] },
  },
];

function makeResult(role) {
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
  return result;
}

function createAdapter() {
  const calls = [];
  return {
    calls,
    async invoke(request) {
      calls.push(request);
      return {
        result: makeResult(request.role),
        metadata: { sessionID: `ses-${request.role}` },
      };
    },
  };
}

test("ANALYZE runs analyst, architect and reviewer without builder", async () => {
  const adapter = createAdapter();

  const outcome = await runAgentFeedbackOrchestration({
    taskId: TASK_ID,
    objective: "analiza el loop de agentes",
    acceptanceCriteria: CRITERIA,
    adapter,
    mode: "ANALYZE",
  });

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "REVIEWER"],
  );
  assert.equal(adapter.calls.some((call) => call.role === "BUILDER"), false);
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
});

test("ANALYZE stops exhausted when the reviewer asks for revision", async () => {
  const adapter = {
    calls: [],
    async invoke(request) {
      this.calls.push(request);
      const result = makeResult(request.role);
      result.taskId = request.taskId;
      result.invocationId = request.invocationId;
      if (request.role === "REVIEWER") {
        result.review = {
          verdict: "REVISION_REQUIRED",
          findings: [
            {
              id: "F1",
              description: "missing evidence",
              severity: "HIGH",
              evidence: ["ev-1"],
              correctiveAction: "add evidence",
            },
          ],
          limitations: [],
        };
      }
      return {
        result,
        metadata: { sessionID: `ses-${request.role}` },
      };
    },
  };

  const outcome = await runAgentFeedbackOrchestration({
    taskId: TASK_ID,
    objective: "analiza el loop de agentes",
    acceptanceCriteria: CRITERIA,
    adapter,
    mode: "ANALYZE",
    maxRevisionCycles: 0,
    maxReplanCycles: 0,
  });

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "REVIEWER"],
  );
  assert.equal(outcome.status, "REVISION_REQUIRED");
  assert.equal(outcome.exhausted, true);
});

test("ANALYZE iterates on reviewer revision findings", async () => {
  const finding = {
    id: "F1",
    description: "missing evidence",
    severity: "HIGH",
    evidence: ["ev-1"],
    correctiveAction: "add evidence",
  };
  let reviews = 0;
  const adapter = {
    calls: [],
    async invoke(request) {
      this.calls.push(request);
      const result = makeResult(request.role);
      result.taskId = request.taskId;
      result.invocationId = request.invocationId;
      if (request.role === "REVIEWER") {
        reviews += 1;
        const verdict = reviews === 1 ? "REVISION_REQUIRED" : "ACCEPTED";
        result.review = {
          verdict,
          findings: verdict === "ACCEPTED" ? [] : [finding],
          limitations: [],
        };
      }
      return { result, metadata: { sessionID: `ses-${request.role}` } };
    },
  };

  const outcome = await runAgentFeedbackOrchestration({
    taskId: TASK_ID,
    objective: "analiza el loop de agentes",
    acceptanceCriteria: CRITERIA,
    adapter,
    mode: "ANALYZE",
  });

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "REVIEWER", "ANALYST", "ARCHITECT", "REVIEWER"],
  );
  assert.equal(
    adapter.calls[3].input.constraints.some((constraint) => constraint.includes("missing evidence")),
    true,
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
});

test("ANALYZE replans with the architect when the reviewer requires replanning", async () => {
  const finding = {
    id: "F1",
    description: "strategy is incomplete",
    severity: "HIGH",
    evidence: ["ev-1"],
    correctiveAction: "rework the strategy",
  };
  let reviews = 0;
  const adapter = {
    calls: [],
    async invoke(request) {
      this.calls.push(request);
      const result = makeResult(request.role);
      result.taskId = request.taskId;
      result.invocationId = request.invocationId;
      if (request.role === "REVIEWER") {
        reviews += 1;
        const verdict = reviews === 1 ? "REPLAN_REQUIRED" : "ACCEPTED";
        result.review = {
          verdict,
          findings: verdict === "ACCEPTED" ? [] : [finding],
          limitations: [],
        };
      }
      return { result, metadata: { sessionID: `ses-${request.role}` } };
    },
  };

  const outcome = await runAgentFeedbackOrchestration({
    taskId: TASK_ID,
    objective: "analiza el loop de agentes",
    acceptanceCriteria: CRITERIA,
    adapter,
    mode: "ANALYZE",
  });

  assert.deepEqual(
    adapter.calls.map((call) => call.role),
    ["ANALYST", "ARCHITECT", "REVIEWER", "ARCHITECT", "REVIEWER"],
  );
  assert.equal(outcome.status, "COMPLETED");
  assert.equal(outcome.verdict, "ACCEPTED");
});
