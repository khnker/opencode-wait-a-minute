/**
 * Workload matrix — deterministic scenario descriptors for the efficiency envelope.
 *
 * Four families cover the envelope (local / contextual / continuation / negative) and the
 * continuation family is expanded across 1, 3, 5, 10 and 20 turns to expose the
 * avoided-rebuild vs. context-consumption relationship.
 *
 * These are DESCRIPTORS, not live runs: no RNG, no network, no wall-clock in the data.
 * `simulateWorkload` turns a descriptor into the per-scenario result object consumed by
 * `../evaluation/causal-metrics.mjs` using a purely deterministic token model.
 *
 * Shape reuses the existing `scenarios/real.mjs` contract so runners can consume it:
 *   { id, family, category, name, description, budget, turns: [{ prompt, input, rebuildScope }] }
 */

export const WORKLOAD_FAMILIES = ["local", "contextual", "continuation", "negative"];

export const CONTINUATION_TURNS = [1, 3, 5, 10, 20];

/** Rebuild scopes, ordered from most to least work. */
export const REBUILD_SCOPES = ["full", "partial", "fast-path"];

const CHARS_PER_TOKEN = 4;
const FILLER_LEN = 400;

const filler = (tag, i, len = FILLER_LEN) => `${tag}[${i}] `.padEnd(len, "context");

const requirements = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}R${i}`, title: filler(`${prefix}-requirement`, i) }));
const evidence = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}E${i}`, content: filler(`${prefix}-evidence`, i), status: "valid" }));
const decisions = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}D${i}`, summary: filler(`${prefix}-decision`, i) }));
const constraints = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}C${i}`, description: filler(`${prefix}-constraint`, i) }));
const artifacts = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}A${i}`, content: filler(`${prefix}-artifact`, i) }));
const observations = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}O${i}`, content: filler(`${prefix}-observation`, i) }));

/** Deterministic context bundle, same contract as `scenarios/real.mjs`. */
function context({ taskId, objective, reqs = 0, evs = 0, decs = 0, cons = 0, arts = 0, obs = 0 }) {
  const prefix = `${taskId}:`;
  return {
    taskState: {
      taskId,
      contract: { objective: filler(objective, 0) },
      requirements: requirements(reqs, prefix),
    },
    runState: {},
    evidenceLineage: evidence(evs, prefix),
    decisions: decisions(decs, prefix),
    constraints: constraints(cons, prefix),
    artifacts: artifacts(arts, prefix),
    observations: observations(obs, prefix),
    hypotheses: [],
    experiments: [],
  };
}

const turn = (prompt, input, rebuildScope) => ({ prompt, input, rebuildScope });

/** Families ------------------------------------------------------------- */

const LOCAL = Object.freeze({
  id: "local-1",
  family: "local",
  category: "local",
  name: "Minimal-context single-step task",
  description: "Small task with minimal context; isolates WAM fixed overhead.",
  budget: 4000,
  expectedVerification: "success",
  model: { overheadTokens: 180, partialRatio: 0.6, fastPathRatio: 0.5 },
  turns: [turn("Complete the task.", context({ taskId: "local-1", objective: "local-objective", reqs: 1, evs: 1 }), "partial")],
});

const CONTEXTUAL = Object.freeze({
  id: "contextual-1",
  family: "contextual",
  category: "contextual",
  name: "Project/domain context, selective assembly",
  description: "Requires project/domain context so only relevant items are assembled.",
  budget: 4000,
  expectedVerification: "success",
  model: { overheadTokens: 180, partialRatio: 0.35, fastPathRatio: 0.3 },
  turns: [
    turn(
      "Apply the project-scoped change.",
      context({ taskId: "contextual-1", objective: "contextual-objective", reqs: 4, evs: 4, decs: 2, cons: 2 }),
      "partial",
    ),
  ],
});

const NEGATIVE = Object.freeze({
  id: "negative-1",
  family: "negative",
  category: "negative",
  name: "Overhead exceeds savings",
  description: "Tiny context with heavy WAM overhead; savings must NOT be clamped to >= 0.",
  budget: 4000,
  expectedVerification: "success",
  model: { overheadTokens: 1400, partialRatio: 0.9, fastPathRatio: 0.9 },
  turns: [turn("Complete the task.", context({ taskId: "negative-1", objective: "negative-objective", reqs: 1 }), "partial")],
});

/** Continuation: turn 1 is cold (full rebuild), every later turn repeats the SAME
 *  context payload, so a valid snapshot lets WAM take the fast path. */
function continuationScenario(turnCount) {
  const id = `continuation-${turnCount}t`;
  const shared = context({
    taskId: id,
    objective: "continuation-objective",
    reqs: 6,
    evs: 6,
    decs: 4,
    cons: 4,
    arts: 4,
    obs: 4,
  });
  const turns = [turn("Turn 1: acknowledge the task.", shared, "full")];
  for (let i = 2; i <= turnCount; i += 1) {
    turns.push(turn(`Turn ${i}: continue the same task.`, shared, "fast-path"));
  }

  return Object.freeze({
    id,
    family: "continuation",
    category: "continuation",
    name: `Continuation over ${turnCount} turn${turnCount === 1 ? "" : "s"}`,
    description: `Multi-turn task repeating the same context across ${turnCount} turn(s).`,
    budget: 4000,
    turnCount,
    expectedVerification: "success",
    model: { overheadTokens: 180, partialRatio: 0.35, fastPathRatio: 0.12 },
    turns: Object.freeze(turns),
  });
}

export const CONTINUATION_SCENARIOS = Object.freeze(CONTINUATION_TURNS.map(continuationScenario));

export const WORKLOAD_SCENARIOS = Object.freeze([
  LOCAL,
  CONTEXTUAL,
  ...CONTINUATION_SCENARIOS,
  NEGATIVE,
]);

export function getWorkloadScenario(id) {
  return WORKLOAD_SCENARIOS.find((s) => s.id === id) || null;
}

/** Deterministic token model ------------------------------------------------ */

const estimateTokens = (text) => Math.ceil(text.length / CHARS_PER_TOKEN);

const turnInputTokens = (t) => estimateTokens(`${t.prompt}${JSON.stringify(t.input)}`);

function wamTurnTokens(scenario, t) {
  const full = turnInputTokens(t);
  const { overheadTokens, partialRatio, fastPathRatio } = scenario.model;
  const ratio = t.rebuildScope === "full" ? 1 : t.rebuildScope === "partial" ? partialRatio : fastPathRatio;
  return Math.ceil(full * ratio) + overheadTokens;
}

/**
 * Turn a workload descriptor into the causal-metrics input shape.
 * Deterministic: no RNG, no network, no clock.
 *
 * @returns {{ scenarioId: string, family: string, turns: number,
 *   collectorSnapshot: Record<string, number>, verification: unknown,
 *   tokens: { input: number, output: number, total: number },
 *   baseline: { tokens: { input: number, output: number, total: number } } }}
 */
export function simulateWorkload(scenario) {
  const counters = {
    Context_assembled: 0,
    Context_reconstructed: 0,
    Context_fast_path: 0,
    Snapshot_hit: 0,
    Snapshot_miss: 0,
    Mandatory_items: 0,
    Conditional_items: 0,
    Optional_items: 0,
    Tokens_before: 0,
    Tokens_after: 0,
    Reconstruction_count: 0,
  };

  let wamInput = 0;
  let baselineInput = 0;

  for (const t of scenario.turns) {
    const full = turnInputTokens(t);
    baselineInput += full;
    wamInput += wamTurnTokens(scenario, t);

    counters.Context_assembled += 1;
    counters.Tokens_before += full;
    counters.Tokens_after += wamTurnTokens(scenario, t);

    if (t.rebuildScope === "full") {
      counters.Snapshot_miss += 1;
      counters.Context_reconstructed += 1;
      counters.Reconstruction_count += 1;
    } else if (t.rebuildScope === "partial") {
      counters.Snapshot_hit += 1;
      counters.Context_reconstructed += 1;
      counters.Reconstruction_count += 1;
    } else {
      counters.Snapshot_hit += 1;
      counters.Context_fast_path += 1;
    }

    counters.Mandatory_items += scenario.turns[0].input.taskState.requirements.length;
  }

  // Output side: responses are not produced by the descriptor model, so it stays 0 and
  // `total` mirrors `input`. Live runners override this with real provider usage.
  const output = 0;

  return {
    scenarioId: scenario.id,
    family: scenario.family,
    turns: scenario.turns.length,
    turnTrace: scenario.turns.map((t) => ({ rebuildScope: t.rebuildScope })),
    collectorSnapshot: counters,
    verification: scenario.expectedVerification,
    tokens: { input: wamInput, output, total: wamInput + output },
    baseline: { tokens: { input: baselineInput, output, total: baselineInput + output } },
  };
}

/** Convenience: simulate every scenario in the matrix, in order. */
export function simulateWorkloadMatrix() {
  return WORKLOAD_SCENARIOS.map(simulateWorkload);
}
