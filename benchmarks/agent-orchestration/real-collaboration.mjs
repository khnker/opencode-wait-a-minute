import { pathToFileURL } from "node:url";
import path from "node:path";

import { runAgentFeedbackOrchestration } from "../../src/agents/orchestrator.js";

export const BENCHMARK_ID = "agent-collaboration-real";

export const DEFAULT_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "accepted-first-pass",
    seed: 101,
    objective: "Harden the auth route with rate limiting and land it in a single pass",
    maxRevisionCycles: 2,
    maxReplanCycles: 1,
    expected: Object.freeze({
      completed: true,
      accepted: true,
      revisions: 0,
      replans: 0,
    }),
  }),
  Object.freeze({
    id: "revision-accepted",
    seed: 202,
    objective: "Harden the auth route with rate limiting, fixing review findings before acceptance",
    maxRevisionCycles: 1,
    maxReplanCycles: 0,
    expected: Object.freeze({
      completed: true,
      accepted: true,
      revisions: 1,
      replans: 0,
    }),
  }),
]);

const ACCEPTANCE_CRITERIA = Object.freeze([
  Object.freeze({
    id: "AC1",
    description: "Auth rate limiting is enforced and tested",
    mandatory: true,
    evidenceRequirements: Object.freeze({ tests: Object.freeze(["unit"]) }),
  }),
]);

function estimateTokens(requests, results) {
  const chars = [...requests, ...results].reduce(
    (total, value) => total + JSON.stringify(value).length,
    0,
  );
  return Math.ceil(chars / 4);
}

function countReviewArtifacts(results) {
  return results.reduce((total, entry) => {
    if (entry.role !== "REVIEWER") return total;
    return total + (entry.result.artifacts?.length ?? 0);
  }, 0);
}

function adapterModuleSpecifier(value) {
  if (value.startsWith("file:")) return value;
  return pathToFileURL(path.resolve(value)).href;
}

function recordAdapter(adapter) {
  const requests = [];
  const results = [];
  return {
    requests,
    results,
    async invoke(request) {
      requests.push(request);
      const invocation = await adapter.invoke(request);
      if (invocation?.result) results.push(invocation.result);
      return invocation;
    },
  };
}

function measureScenario({ scenario, outcome, adapter }) {
  const revisions = outcome.cycles?.revisions ?? 0;
  const replans = outcome.cycles?.replans ?? 0;
  const completed = outcome.status === "COMPLETED";
  const accepted = completed && outcome.verdict === "ACCEPTED";
  const metrics = {
    completed,
    accepted,
    revisions,
    replans,
    agentInvocations: outcome.results?.length ?? 0,
    handoffs: outcome.handoffs?.length ?? 0,
    independentReviewArtifacts: countReviewArtifacts(outcome.results ?? []),
    estimatedTokens: estimateTokens(adapter.requests, adapter.results),
  };
  const expectedMet = Object.entries(scenario.expected ?? {}).every(
    ([key, value]) => metrics[key] === value,
  );
  return {
    scenario: scenario.id,
    seed: scenario.seed,
    objective: scenario.objective,
    expected: { ...scenario.expected },
    metrics,
    expectedMet,
  };
}

export async function runRealCollaborationBenchmark({
  adapterFactory,
  scenarios = DEFAULT_SCENARIOS,
} = {}) {
  if (typeof adapterFactory !== "function") {
    throw new TypeError(
      "runRealCollaborationBenchmark requires an adapterFactory({ scenario }) returning { invoke(request) }",
    );
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new TypeError("scenarios must be a non-empty array");
  }

  const records = [];
  for (const scenario of scenarios) {
    const adapter = await adapterFactory({ scenario });
    if (typeof adapter?.invoke !== "function") {
      throw new TypeError(
        `adapterFactory for scenario ${scenario.id} must return an object with invoke(request)`,
      );
    }
    const observed = recordAdapter(adapter);
    const outcome = await runAgentFeedbackOrchestration({
      taskId: `benchmark-${scenario.id}`,
      objective: scenario.objective,
      acceptanceCriteria: ACCEPTANCE_CRITERIA,
      adapter: observed,
      maxRevisionCycles: scenario.maxRevisionCycles ?? 0,
      maxReplanCycles: scenario.maxReplanCycles ?? 0,
    });
    records.push(measureScenario({ scenario, outcome, adapter: observed }));
  }

  return { benchmark: BENCHMARK_ID, scenarios: records };
}

async function loadAdapterFactory(specifier) {
  const module = await import(adapterModuleSpecifier(specifier));
  const factory = module.createAdapterFactory ?? module.default;
  if (typeof factory !== "function") {
    throw new TypeError(
      `module ${specifier} must export createAdapterFactory or a default function`,
    );
  }
  return factory;
}

async function runCli() {
  const specifier = process.env.WAM_AGENT_BENCH_ADAPTER;
  if (!specifier) {
    throw new Error(
      "WAM_AGENT_BENCH_ADAPTER is required: point it at a module exporting createAdapterFactory({ scenario }) or default",
    );
  }
  const adapterFactory = await loadAdapterFactory(specifier);
  const report = await runRealCollaborationBenchmark({ adapterFactory });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.scenarios.every((entry) => entry.expectedMet)) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
