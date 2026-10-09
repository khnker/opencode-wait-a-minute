/**
 * False-Completion Benchmark Runner
 *
 * For each scenario, this runner:
 *   1. Builds a task state with the scenario's requirements and evidence.
 *   2. Computes the baseline false-completion rate ("no WAM" world):
 *      treats the agent claim as self-verified and runs guardCompletion /
 *      validateCompletionClaim on it. If those naive checks accept the claim,
 *      it counts as a false completion.
 *   3. Computes the WAM false-completion rate by driving the actual
 *      chat.message hook with the same claim. If the WAM completion gate
 *      blocks the message, no false completion is counted.
 *   4. Persists the JSON artifact to benchmarks/results/false-completion-<iso>.json
 *
 * Exports:
 *   runFalseCompletionBenchmark() -> Promise<result>
 *   evaluateScenario(scenario) -> Promise<per-scenario metrics>
 */

import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import pluginDefault from "../../../index.js";
import { getTaskState, persistTaskState } from "../../../src/skills/engine.js";
import {
  guardCompletion,
} from "../../../src/verification/claim-completion.js";
import {
  validateCompletionClaim,
} from "../../../src/verification/false-completion-prevention.js";
import { FALSE_COMPLETION_SCENARIOS } from "../../scenarios/false-completion.mjs";

const CWD = process.cwd();
const RESULTS_DIR = path.join(CWD, "benchmarks", "results");

/**
 * Manually create a task state with the scenario's exact requirements,
 * bypassing the normal chat.message flow to avoid re-analysis.
 */
async function prepareTaskState(scenario) {
  const taskId = `${scenario.id}-${Date.now()}`;

  // Manually construct the task state with APPROVED contract and scenario requirements.
  const state = {
    taskId,
    phase: "IMPLEMENTING",
    contract: {
      status: "APPROVED",
      requirements: scenario.requirements.map((r) => r.title),
    },
    requirements: scenario.requirements.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      evidence: r.evidence || [],
      optional: r.optional !== undefined ? r.optional : false,
    })),
    evidence: scenario.requirements.flatMap((r) =>
      (r.evidence || []).map((summary) => ({
        requirementId: r.id,
        kind: "test",
        summary,
        status: r.status === "done" || r.status === "verified" ? "PASS" : "FAIL",
      }))
    ),
    contractDisplayed: true,
    objective: scenario.objective,
  };

  persistTaskState(taskId, state, CWD);
  return taskId;
}

/**
 * Drive the plugin's chat.message hook with the agent's completion claim.
 * Returns true if the WAM completion gate blocked the claim.
 */
async function runWamGate(taskId, scenario) {
  const hooks = await pluginDefault({
    directory: CWD,
    client: {},
    project: {},
    $: {},
  });
  const out = { message: {}, parts: [] };
  await hooks["chat.message"](
    {
      sessionID: `fc-${scenario.id}-claim`,
      message: {
        parts: [{ type: "text", text: scenario.agentMessage }],
      },
      taskId,
    },
    out
  );

  const gateText = out.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n");

  return /COMPLETION GATE/.test(gateText) && /BLOQUEADO|BLOCK|No declare|No declares/.test(gateText);
}

/**
 * Baseline evaluation: naive check that only looks at the claim itself,
 * ignoring the real task state. We treat the claim as self-verified
 * (state: "VERIFIED") and run guardCompletion/validateCompletionClaim on it.
 * This simulates the agent saying "DONE" with no independent verification.
 *
 * Returns true if the naive baseline would ACCEPT the claim (false completion).
 */
function runBaseline(scenario) {
  const claim = scenario.claim;

  // Guard-level baseline: is there a completion token AND would a self-verified
  // claim pass? (Simulates no WAM gate.)
  const guard = guardCompletion(scenario.agentMessage, {
    ...claim,
    state: "VERIFIED",
  });

  // Claim-level validation baseline: if we hand it a fake "all verified"
  // task state, validateCompletionClaim would also accept it.
  const fakeVerifiedState = {
    requirements: scenario.requirements.map((r) => ({
      ...r,
      status: "verified",
      evidence: ["baseline-fake-evidence"],
      optional: false,
    })),
    evidence: scenario.requirements.map((r) => ({
      requirementId: r.id,
      kind: "test",
      summary: "baseline-fake-evidence",
      status: "PASS",
    })),
  };
  const validation = validateCompletionClaim(claim, fakeVerifiedState);

  // Baseline accepts if either naive check would not block.
  return !guard.blocked || validation.valid;
}

/**
 * Compute metrics for a single scenario.
 */
export async function evaluateScenario(scenario) {
  const taskId = await prepareTaskState(scenario);

  const baselineAccepts = runBaseline(scenario);
  const wamBlocks = await runWamGate(taskId, scenario);

  return {
    id: scenario.id,
    name: scenario.name,
    baselineFalseCompletion: baselineAccepts ? 1 : 0,
    wamFalseCompletion: wamBlocks ? 0 : 1,
    correctCompletion: baselineAccepts && wamBlocks ? 1 : 0,
    testsPassing: wamBlocks ? 1 : 0,
    gateBlocked: wamBlocks,
    details: {
      taskId,
      failingTest: scenario.failingTest,
    },
  };
}

/**
 * Run the full false-completion benchmark.
 */
export async function runFalseCompletionBenchmark(scenarios = FALSE_COMPLETION_SCENARIOS) {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const scenario of scenarios) {
    results.push(await evaluateScenario(scenario));
  }

  const totals = results.reduce(
    (acc, r) => ({
      baselineFalseCompletion: acc.baselineFalseCompletion + r.baselineFalseCompletion,
      wamFalseCompletion: acc.wamFalseCompletion + r.wamFalseCompletion,
      correctCompletion: acc.correctCompletion + (r.correctCompletion ? 1 : 0),
      testsPassing: acc.testsPassing + (r.testsPassing ? 1 : 0),
    }),
    {
      baselineFalseCompletion: 0,
      wamFalseCompletion: 0,
      correctCompletion: 0,
      testsPassing: 0,
    }
  );

  const report = {
    benchmark: "false-completion",
    timestamp: startedAt,
    scenarios: results,
    totals,
  };

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const safeIso = startedAt.replace(/[:.]/g, "-");
  const artifactPath = path.join(RESULTS_DIR, `false-completion-${safeIso}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(report, null, 2), "utf8");

  return { report, artifactPath };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { report, artifactPath } = await runFalseCompletionBenchmark();
  console.log(JSON.stringify({ artifactPath, totals: report.totals }, null, 2));
}
