import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  BENCHMARK_ID,
  DEFAULT_SCENARIOS,
  runRealCollaborationBenchmark,
} from "./real-collaboration.mjs";
import { assertAgentRequest } from "../../src/agents/role-contracts.js";

const REVIEW_FINDING = Object.freeze({
  id: "R1",
  description: "Rate limiting is missing",
  severity: "HIGH",
  evidence: ["tests/auth.test.js"],
  correctiveAction: "Add the rate limit middleware",
  criterionId: "AC1",
});

const REVIEWER_ARTIFACTS = Object.freeze({
  "accepted-first-pass": ["review:accepted"],
  "revision-accepted": ["review:revision", "review:accepted"],
});

function makeResult(request, overrides = {}) {
  return {
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
    ...(request.role === "REVIEWER"
      ? { review: { verdict: "ACCEPTED", findings: [], limitations: [] } }
      : {}),
    ...overrides,
  };
}

function review(verdict, findings, artifact) {
  return {
    review: { verdict, findings, limitations: [] },
    artifacts: [artifact],
  };
}

function scenarioSequences(scenario) {
  if (scenario.id === "revision-accepted") {
    return {
      BUILDER: [
        { artifacts: ["src/auth.js"], evidence: ["ev-first-pass"] },
        { artifacts: ["src/auth-rate-limit.js"], evidence: ["ev-fixed"] },
      ],
      REVIEWER: [
        review("REVISION_REQUIRED", [REVIEW_FINDING], "review:revision"),
        review("ACCEPTED", [], "review:accepted"),
      ],
    };
  }
  return {
    BUILDER: [
      { artifacts: ["src/auth-rate-limit.js"], evidence: ["ev-first-pass"] },
    ],
    REVIEWER: [review("ACCEPTED", [], "review:accepted")],
  };
}

function createScriptedFactory(seen = []) {
  return async ({ scenario }) => {
    const sequences = scenarioSequences(scenario);
    const indexes = {};
    return {
      async invoke(request) {
        assertAgentRequest(request);
        seen.push(request);
        const sequence = sequences[request.role] ?? [{}];
        const index = indexes[request.role] ?? 0;
        indexes[request.role] = index + 1;
        const override = sequence[Math.min(index, sequence.length - 1)];
        return { result: makeResult(request, override) };
      },
    };
  };
}

function scenarioRecord(report, id) {
  const record = report.scenarios.find((entry) => entry.scenario === id);
  assert.ok(record, `missing scenario ${id}`);
  return record;
}

test("rejects when adapterFactory is missing", async () => {
  await assert.rejects(
    () => runRealCollaborationBenchmark(),
    /adapterFactory/,
  );
  await assert.rejects(
    () => runRealCollaborationBenchmark({ adapterFactory: "not-a-function" }),
    /adapterFactory/,
  );
});

test("scripted factory runs both scenarios deterministically", async () => {
  const first = await runRealCollaborationBenchmark({
    adapterFactory: createScriptedFactory(),
  });
  const second = await runRealCollaborationBenchmark({
    adapterFactory: createScriptedFactory(),
  });

  assert.equal(first.benchmark, BENCHMARK_ID);
  assert.deepEqual(
    first.scenarios.map((entry) => entry.scenario),
    DEFAULT_SCENARIOS.map((entry) => entry.id),
  );
  assert.deepEqual(first, second);
  assert.equal(
    JSON.stringify(JSON.parse(JSON.stringify(first))),
    JSON.stringify(first),
  );
  for (const entry of first.scenarios) {
    assert.equal(entry.expectedMet, true, `${entry.scenario} expected outcome`);
    assert.equal(entry.metrics.completed, true);
    assert.equal(entry.metrics.accepted, true);
  }
  assert.equal(scenarioRecord(first, "accepted-first-pass").metrics.revisions, 0);
  assert.equal(scenarioRecord(first, "revision-accepted").metrics.revisions, 1);
  assert.ok(
    scenarioRecord(first, "accepted-first-pass").metrics.estimatedTokens > 0,
  );
});

test("metrics count real orchestrator invocations, handoffs and review artifacts", async () => {
  const { scenarios } = await runRealCollaborationBenchmark({
    adapterFactory: createScriptedFactory(),
  });

  const firstPass = scenarioRecord(
    { scenarios },
    "accepted-first-pass",
  ).metrics;
  assert.equal(firstPass.agentInvocations, 4);
  assert.equal(firstPass.handoffs, 3);
  assert.equal(
    firstPass.independentReviewArtifacts,
    REVIEWER_ARTIFACTS["accepted-first-pass"].length,
  );
  assert.equal(firstPass.revisions, 0);
  assert.equal(firstPass.replans, 0);

  const revision = scenarioRecord({ scenarios }, "revision-accepted").metrics;
  assert.equal(revision.agentInvocations, 6);
  assert.equal(revision.handoffs, 5);
  assert.equal(
    revision.independentReviewArtifacts,
    REVIEWER_ARTIFACTS["revision-accepted"].length,
  );
  assert.equal(revision.revisions, 1);
  assert.equal(revision.replans, 0);
});

test("adapter receives validated, role-appropriate requests", async () => {
  const seen = [];
  await runRealCollaborationBenchmark({
    adapterFactory: createScriptedFactory(seen),
  });

  const firstScenario = seen.filter((request) =>
    request.taskId === "benchmark-accepted-first-pass",
  );
  assert.deepEqual(
    firstScenario.map((request) => request.role),
    ["ANALYST", "ARCHITECT", "BUILDER", "REVIEWER"],
  );
  for (const request of seen) {
    assert.equal(typeof request.taskId, "string");
    assert.equal(typeof request.invocationId, "string");
    assert.equal(typeof request.objective, "string");
    assert.ok(Array.isArray(request.acceptanceCriteria));
    assert.ok(request.acceptanceCriteria.length > 0);
    assert.ok(Array.isArray(request.expectedOutput));
    assert.ok(request.expectedOutput.length > 0);
    assert.ok(request.input && typeof request.input === "object");
  }
  assert.equal(
    seen.filter((request) => request.role === "REVIEWER").length,
    3,
    "two reviewers on the revision scenario",
  );
});

test("importing the module does not execute the benchmark", () => {
  const moduleUrl = new URL("./real-collaboration.mjs", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import(${JSON.stringify(moduleUrl)}).then((m) => process.stdout.write(m.BENCHMARK_ID))`,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, BENCHMARK_ID);
  assert.equal(result.stderr, "");
});

test("CLI fails loud when WAM_AGENT_BENCH_ADAPTER is missing", () => {
  const { WAM_AGENT_BENCH_ADAPTER, ...env } = process.env;
  assert.equal(WAM_AGENT_BENCH_ADAPTER, undefined);
  const result = spawnSync(
    process.execPath,
    [new URL("./real-collaboration.mjs", import.meta.url).pathname],
    { encoding: "utf8", env },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WAM_AGENT_BENCH_ADAPTER/);
});
