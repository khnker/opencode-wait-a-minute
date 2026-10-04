/**
 * Paired real-LLM runner for the RC1 experiment.
 *
 * Enforces the three protocol rules that make a token-saving number meaningful:
 *   1. Identical inputs   - both arms build their request from the same turn
 *                           input, with the same generation parameters.
 *   2. No cross-contamination - baseline output is NEVER fed into the WAM arm;
 *                           each arm is constructed purely from scenario state.
 *   3. Outcome parity      - savings are aggregated only when both arms reach
 *                           the same outcome, otherwise INVALID_COMPARISON.
 */

import { extractUsage, wamInputReduction } from "../telemetry/token-usage.mjs";
import { latencyDelta } from "../telemetry/latency.mjs";
import { outcomeMatches, classifyComparison, VALID, INVALID_COMPARISON } from "../telemetry/outcome.mjs";

import { assembleContext } from "../../../assembly.js";
import { buildRuntimeContextGraph } from "../../../runtime-context-graph.js";

/** Build the baseline request: raw full context graph. */
function buildBaselineRequest(turn) {
  const graph = buildRuntimeContextGraph(turn.input);
  const nodes = Array.from(graph.getNodes().values()).sort((a, b) => a.createdAt - b.createdAt);
  const rawContext = nodes.map(n => `[Type: ${n.type}]\n${n.content}\n---`).join("\n");
  const prompt = `${rawContext}\n\n[Task]\n${turn.prompt}`;
  return {
    messages: [{ role: "user", content: prompt }],
    maxTokens: turn?.maxTokens
  };
}

/** Build the WAM request: optimized minimal context assembled via WAM engine + user prompt. */
function buildWamRequest(scenario, turn) {
  const assembly = assembleContext({
    prompt: turn.prompt,
    taskId: scenario.id,
    ...turn.input,
    budget: turn.budget ?? 4000
  });
  const lines = [...assembly.lines, `[Task]\n${turn.prompt}`];
  const prompt = lines.join("\n");
  return {
    messages: [{ role: "user", content: prompt }],
    maxTokens: turn?.maxTokens
  };
}

/** Sum a numeric field across turns for one arm. */
function sumUsage(turns, pick) {
  return turns.reduce((total, turn) => total + pick(turn), 0);
}

/**
 * Run one scenario twice (baseline arm + WAM arm) with identical inputs.
 *
 * @param {{scenario: Object, provider: Object}} args
 * @returns {Promise<Object>} paired run result
 */
export async function runPairedScenario({ scenario, provider }) {
  if (!scenario) throw new Error("runPairedScenario requires a scenario");
  if (!provider || typeof provider.complete !== "function") {
    throw new Error("runPairedScenario requires a provider with complete()");
  }

  const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
  const results = [];

  for (const [turnIndex, turn] of turns.entries()) {
    // Rule 1 + 2: the request is rebuilt from scenario state for BOTH arms.
    // Nothing produced by the baseline arm is ever reachable from here.
    const baseline = await provider.complete(buildBaselineRequest(turn));
    const wam = await provider.complete(buildWamRequest(scenario, turn));

    const match = outcomeMatches(baseline?.text, wam?.text);
    results.push({ turnIndex, baseline, wam, outcomeMatch: match });
  }

  // Rule 3: one diverging turn invalidates the whole scenario comparison.
  const scenarioMatch = results.every((r) => r.outcomeMatch);
  const comparison = classifyComparison(scenarioMatch);

  const baselineUsage = results.map((r) => extractUsage(r.baseline));
  const wamUsage = results.map((r) => extractUsage(r.wam));

  const baselineInput = sumUsage(baselineUsage, (u) => u.inputTokens);
  const wamInput = sumUsage(wamUsage, (u) => u.inputTokens);
  const baselineTotal = sumUsage(baselineUsage, (u) => u.totalTokens);
  const wamTotal = sumUsage(wamUsage, (u) => u.totalTokens);
  const baselineMs = sumUsage(
    results.map((r) => ({ ms: r.baseline?.latencyMs })),
    (x) => x.ms
  );
  const wamMs = sumUsage(
    results.map((r) => ({ ms: r.wam?.latencyMs })),
    (x) => x.ms
  );

  // Provider-side cache tokens are reported on their own, never folded into
  // inputTokenReductionPct (protocol rule 4, Metric Isolation).
  const cachedInputTokens = sumUsage(wamUsage, (u) => u.cachedInputTokens);

  if (comparison === INVALID_COMPARISON) {
    return {
      scenarioId: scenario.id,
      outcomeMatch: false,
      comparison,
      turns: results,
      metrics: {
        inputTokenReductionPct: null,
        totalTokenDeltaPct: null,
        latencyDeltaPct: null,
        cachedInputTokens,
        invalidReason: "outcome_mismatch"
      }
    };
  }

  const inputReduction = wamInputReduction({ baseline: baselineInput, input: wamInput });
  const totalDelta = wamInputReduction({ baseline: baselineTotal, input: wamTotal });
  const latency = latencyDelta({ baselineMs, wamMs });

  return {
    scenarioId: scenario.id,
    outcomeMatch: true,
    comparison: VALID,
    turns: results,
    metrics: {
      inputTokenReductionPct: inputReduction.pct,
      totalTokenDeltaPct: totalDelta.pct,
      latencyDeltaPct: latency.pct,
      cachedInputTokens
    }
  };
}

/**
 * Run a suite of scenarios, repeating each `trials` times.
 *
 * @param {{scenarios: Array<Object>, provider: Object, trials?: number}} args
 * @returns {Promise<{runs: Array<Object>, totals: {turns: number, valid: number, invalid: number}}>}
 */
export async function runPairedSuite({ scenarios, provider, trials = 1 }) {
  if (!Array.isArray(scenarios)) throw new Error("runPairedSuite requires a scenarios array");
  const repeat = Math.max(1, Number(trials) || 1);
  const runs = [];

  for (const scenario of scenarios) {
    for (let trial = 0; trial < repeat; trial += 1) {
      const run = await runPairedScenario({ scenario, provider });
      runs.push({ ...run, trial });
    }
  }

  const totals = runs.reduce(
    (acc, run) => {
      acc.turns += run.turns.length;
      if (run.comparison === VALID) acc.valid += 1;
      else acc.invalid += 1;
      return acc;
    },
    { turns: 0, valid: 0, invalid: 0 }
  );

  return { runs, totals };
}
