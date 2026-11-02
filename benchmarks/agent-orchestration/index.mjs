import { runAgentFeedbackOrchestration } from "../../src/agents/orchestrator.js";

export const BENCHMARK_ID = "agent-orchestration";

const TASK_ID = "benchmark-task";
const ACCEPTANCE_CRITERIA = Object.freeze([
  {
    id: "AC1",
    description: "Auth rate limiting is enforced and tested",
    mandatory: true,
    evidenceRequirements: { tests: ["unit"] },
  },
]);

const REVIEW_FINDING = Object.freeze({
  id: "R1",
  description: "Rate limiting is missing",
  severity: "HIGH",
  evidence: ["tests/auth.test.js"],
  correctiveAction: "Add the rate limit middleware",
  criterionId: "AC1",
});

function makeResult(role, request, overrides = {}) {
  const result = {
    taskId: request.taskId,
    invocationId: request.invocationId,
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

function createScriptedAdapter(sequences = {}) {
  const calls = [];
  const results = [];
  const indexes = {};
  return {
    calls,
    results,
    async invoke(request) {
      calls.push(request);
      const sequence = sequences[request.role] ?? [{}];
      const index = indexes[request.role] ?? 0;
      indexes[request.role] = index + 1;
      const override = sequence[Math.min(index, sequence.length - 1)];
      const resolved = typeof override === "function" ? override(request) : override;
      const result = makeResult(request.role, request, resolved);
      results.push(result);
      return { result, metadata: { sessionID: `bench-${request.invocationId}` } };
    },
  };
}

function countByRole(calls) {
  const byRole = { ANALYST: 0, ARCHITECT: 0, BUILDER: 0, REVIEWER: 0 };
  for (const call of calls) {
    byRole[call.role] = (byRole[call.role] ?? 0) + 1;
  }
  return byRole;
}

function estimateTokens(requests, results) {
  const chars = [...requests, ...results].reduce(
    (total, value) => total + JSON.stringify(value).length,
    0,
  );
  return Math.ceil(chars / 4);
}

function countFindings(results) {
  return results.reduce(
    (total, result) => total + (result.review?.findings?.length ?? 0),
    0,
  );
}

function review(verdict, findings = []) {
  return { review: { verdict, findings, limitations: [] } };
}

function baseOptions(adapter, scenario) {
  return {
    taskId: TASK_ID,
    objective: "Harden authentication with rate limiting",
    acceptanceCriteria: ACCEPTANCE_CRITERIA,
    adapter,
    maxRevisionCycles: scenario.maxRevisionCycles,
    maxReplanCycles: scenario.maxReplanCycles,
  };
}

const SCENARIOS = Object.freeze([
  {
    id: "accepted-first-pass",
    defectInjected: false,
    maxRevisionCycles: 1,
    maxReplanCycles: 0,
    sequences: {},
    expected: { accepted: true, exhausted: false, revisions: 0, replans: 0 },
  },
  {
    id: "revision-accepted",
    defectInjected: true,
    maxRevisionCycles: 1,
    maxReplanCycles: 0,
    sequences: {
      BUILDER: [
        { artifacts: ["src/auth.js"], evidence: ["ev-first-pass"] },
        { artifacts: ["src/auth-rate-limit.js"], evidence: ["ev-fixed"] },
      ],
      REVIEWER: [review("REVISION_REQUIRED", [REVIEW_FINDING]), review("ACCEPTED")],
    },
    expected: { accepted: true, exhausted: false, revisions: 1, replans: 0 },
  },
  {
    id: "replan-accepted",
    defectInjected: true,
    maxRevisionCycles: 1,
    maxReplanCycles: 1,
    sequences: {
      ARCHITECT: [
        {},
        { decisions: [{ id: "D2", description: "Move limiting to the edge", rationale: "testability" }] },
      ],
      BUILDER: [
        { artifacts: ["src/auth.js"], evidence: ["ev-first-pass"] },
        { artifacts: ["src/auth-rate-limit.js"], evidence: ["ev-fixed"] },
      ],
      REVIEWER: [review("REPLAN_REQUIRED", [REVIEW_FINDING]), review("ACCEPTED")],
    },
    expected: { accepted: true, exhausted: false, revisions: 0, replans: 1 },
  },
  {
    id: "exhausted",
    defectInjected: true,
    maxRevisionCycles: 0,
    maxReplanCycles: 0,
    sequences: {
      BUILDER: [{ artifacts: ["src/auth.js"], evidence: ["ev-first-pass"] }],
      REVIEWER: [review("REVISION_REQUIRED", [REVIEW_FINDING])],
    },
    expected: { accepted: false, exhausted: true, revisions: 0, replans: 0 },
  },
]);

async function runBaseline(scenario) {
  const adapter = createScriptedAdapter({
    BUILDER: scenario.sequences.BUILDER ?? [{}],
  });
  const request = {
    taskId: TASK_ID,
    invocationId: `${TASK_ID}:BUILDER:1`,
    role: "BUILDER",
    objective: "Harden authentication with rate limiting",
    acceptanceCriteria: ACCEPTANCE_CRITERIA,
    input: { artifacts: [], evidence: [], constraints: [], priorFindings: [] },
    expectedOutput: "A change plus evidence",
  };
  const { result } = await adapter.invoke(request);
  const accepted = result.status === "COMPLETED";
  return {
    invocations: { total: adapter.calls.length, byRole: countByRole(adapter.calls) },
    estimatedTokens: estimateTokens(adapter.calls, adapter.results),
    accepted,
    findingsCaught: 0,
    falseAccept: scenario.defectInjected && accepted,
    defectResolved: !scenario.defectInjected,
  };
}

async function runFeedback(scenario) {
  const adapter = createScriptedAdapter(scenario.sequences);
  const outcome = await runAgentFeedbackOrchestration(baseOptions(adapter, scenario));
  const findingsCaught = countFindings(adapter.results);
  return {
    invocations: { total: adapter.calls.length, byRole: countByRole(adapter.calls) },
    estimatedTokens: estimateTokens(adapter.calls, adapter.results),
    cycles: { ...outcome.cycles },
    accepted: outcome.status === "COMPLETED" && outcome.verdict === "ACCEPTED",
    exhausted: outcome.exhausted === true,
    stoppedAt: outcome.stoppedAt,
    findingsCaught,
    defectResolved: scenario.defectInjected
      ? findingsCaught > 0 && outcome.status === "COMPLETED" && outcome.verdict === "ACCEPTED"
      : true,
  };
}

export async function runAgentOrchestrationBenchmark() {
  const records = [];
  for (const scenario of SCENARIOS) {
    const baseline = await runBaseline(scenario);
    const feedback = await runFeedback(scenario);
    records.push({ scenario: scenario.id, baseline, feedback, expected: scenario.expected });
  }
  return { benchmark: BENCHMARK_ID, records };
}
