/**
 * Long-context scaling runner — emits a DATA artifact (token numbers),
 * not a chart. For each turn count N in CONTINUATION_SIZES it builds an
 * accumulated history (N turns of identical WAM turns) and measures:
 *
 *   - baselineInputTokens : tokens of the FULL raw history (all N turns
 *                           concatenated into a single prompt, no WAM).
 *   - wamInputTokens      : tokens actually assembled by assembleContext
 *                           (budgeted, deduplicated).
 *   - stateSize           : serialized task-state size (bytes + tokens).
 *   - contextReductionPct : (baseline - wam) / baseline * 100.
 *   - reconstructionFrequency : how many of N turns the WAM arm had to
 *                           rebuild from scratch vs. fast-path.
 *
 * Deterministic and offline — no LLM provider is involved. Tokens use the
 * repo's own estimator (`estimateCapsuleTokens` and the assembly's `estTokens`
 * convention: ceil(length/4)).
 */

import { CONTINUATION_SIZES, buildContinuationScenarios } from "../../scenarios/continuation.mjs";
import { assembleContext } from "../../../src/context/assembly.js";
import { buildRuntimeContextGraph } from "../../../src/context/runtime-context-graph.js";

const BUDGET = 16000;

function estTokens(text = "") {
  return Math.ceil(String(text || "").length / 4);
}

function bytesOf(v) {
  return Buffer.byteLength(JSON.stringify(v), "utf8");
}

/**
 * Baseline prompt for turn t: the raw history of all previous turns
 * concatenated, exactly like a vanilla agent that re-feeds the entire
 * transcript every turn. This is what `baselineInputTokens` measures.
 */
function buildBaselineFullPrompt(scenario, turnIndex) {
  const parts = [];
  for (let i = 0; i <= turnIndex; i++) {
    const t = scenario.turns[i];
    parts.push(`[turn ${i + 1}/${scenario.turns.length}]\n${t.prompt}`);
  }
  return parts.join("\n\n");
}

/**
 * Simulate a single turn: build the accumulated task state, ask
 * assembleContext to (re)assemble the WAM pack, record metrics.
 *
 * The "reconstruction" counter increments whenever the assembled pack
 * is not flagged as a continuation fast-path — i.e. whenever the engine
 * had to rebuild the pack from scratch instead of diffing against the
 * snapshot.
 */
function runOneTurn(scenario, turnIndex, accumulated) {
  const turn = scenario.turns[turnIndex];

  // --- Baseline arm: full raw history re-fed as a single prompt ----
  const baselineFullPrompt = buildBaselineFullPrompt(scenario, turnIndex);
  const baselineInputTokens = estTokens(baselineFullPrompt);

  // --- WAM arm: assembleContext with continuation semantics --------
  const taskState = {
    phase: "PROPOSED",
    contract: { status: "DRAFT", requirements: [] },
    requirements: [],
    nextAction: null,
    turnIndex,
    history: scenario.turns.slice(0, turnIndex + 1).map((t) => t.prompt)
  };
  const reqs = [];
  const evs = [];
  const decs = [];
  const cons = [];
  const arts = [];
  const obs = [];
  for (let i = 0; i <= turnIndex; i++) {
    reqs.push({ id: `req-${i}`, title: `Requirement for turn ${i + 1}` });
    evs.push({ id: `ev-${i}`, content: `Evidence ${i + 1}: ${scenario.turns[i].prompt}`, status: "ok" });
    decs.push({ id: `dec-${i}`, summary: `Decision ${i + 1}: continue with task ${scenario.id}` });
    cons.push({ id: `con-${i}`, description: `Constraint ${i + 1}: stay within budget` });
    arts.push({ id: `art-${i}`, content: `Artifact ${i + 1}: working output of turn ${i + 1}` });
    obs.push({ id: `obs-${i}`, content: `Observation ${i + 1}: state stable after turn ${i + 1}` });
  }

  const assembly = assembleContext({
    prompt: turn.prompt,
    taskId: scenario.id,
    classification: "normal",
    mode: "NORMAL",
    continuation: turnIndex > 0, // turn 0 is the bootstrap; rest are continuations
    projectPath: process.cwd(),
    budget: BUDGET,
    taskState,
    evidenceLineage: [],
    cognitionState: null,
    decisions: decs,
    constraints: cons,
    artifacts: arts,
    observations: obs,
    hypotheses: [],
    experiments: [],
    requirements: reqs,
    selectedSkills: []
  });

  const wamInputTokens = estTokens(assembly.lines.join("\n"));
  const stateBytes = bytesOf(taskState);
  const stateTokens = estTokens(JSON.stringify(taskState));

  // Reconstruction frequency: count turns where continuation semantics
  // did NOT take effect (engine had to rebuild from raw). After turn 0,
  // a fast-path-friendly engine should keep rebuilding cheap; we record
  // 1 per turn where `continuation` flag was honored with a smaller
  // delta vs. the previous assembled pack. For measurement purposes
  // here, every turn after the first is treated as a continuation, and
  // the frequency is the share of N-1 continuation turns.
  let reconstructionFrequency = 0;
  if (turnIndex > 0) {
    const prev = accumulated[turnIndex - 1];
    if (prev) {
      // heuristic: a "rebuild" is when the assembled size jumps more
      // than 10% relative to the previous turn — that means the engine
      // could not reuse the snapshot.
      const delta = Math.abs(wamInputTokens - prev.wamInputTokens) / Math.max(prev.wamInputTokens, 1);
      reconstructionFrequency = delta > 0.1 ? 1 : 0;
    } else {
      reconstructionFrequency = 1;
    }
  }

  return {
    turnIndex,
    baselineInputTokens,
    wamInputTokens,
    stateBytes,
    stateTokens,
    contextReductionPct: baselineInputTokens === 0
      ? 0
      : +(((baselineInputTokens - wamInputTokens) / baselineInputTokens) * 100).toFixed(2),
    reconstructionFrequency,
    budgetUsed: assembly.budget_used,
    budget: assembly.budget,
    budgetViolation: assembly.budget_violation === true
  };
}

/**
 * Public entry point. Returns one row per N in CONTINUATION_SIZES.
 *
 * Row shape:
 *   {
 *     N, baselineInputTokens, wamInputTokens, stateBytes, stateTokens,
 *     contextReductionPct, reconstructionFrequency
 *   }
 */
export function runLongContextScaling({ sizes = CONTINUATION_SIZES } = {}) {
  const scenarios = buildContinuationScenarios(sizes);
  const results = [];
  for (let s = 0; s < scenarios.length; s++) {
    const scenario = scenarios[s];
    const N = scenario.turns.length;
    const turnResults = [];
    for (let i = 0; i < N; i++) {
      turnResults.push(runOneTurn(scenario, i, turnResults));
    }
    // Aggregate per-N: take the LAST turn (worst case for baseline).
    const last = turnResults[turnResults.length - 1];
    const avgWam = turnResults.reduce((a, t) => a + t.wamInputTokens, 0) / turnResults.length;
    const avgBaseline = turnResults.reduce((a, t) => a + t.baselineInputTokens, 0) / turnResults.length;
    const totalReconstructions = turnResults.reduce((a, t) => a + t.reconstructionFrequency, 0);
    results.push({
      N,
      scenarioId: scenario.id,
      baselineInputTokens: last.baselineInputTokens,
      wamInputTokens: last.wamInputTokens,
      avgBaselineInputTokens: Math.round(avgBaseline),
      avgWamInputTokens: Math.round(avgWam),
      stateBytes: last.stateBytes,
      stateTokens: last.stateTokens,
      contextReductionPct: last.contextReductionPct,
      reconstructionFrequency: totalReconstructions
    });
  }
  return results;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = runLongContextScaling();
  console.log(JSON.stringify({ sizes: CONTINUATION_SIZES, results }, null, 2));
}

export default { runLongContextScaling };