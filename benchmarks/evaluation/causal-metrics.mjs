/**
 * Causal metrics — per-scenario mechanism counters plus derived report ratios.
 *
 * The point of this layer is attribution: not just "tokens went down" but WHICH mechanism
 * moved them (rebuild count, fast path, partial vs full, verification state). Negative
 * families MUST be able to report negative savings — nothing here clamps to >= 0.
 */

import { COUNTER_NAMES, createCollector } from "../instrumentation/collector.mjs";

/** Per-scenario causal metric keys (spec: Causal Metrics). */
export const CAUSAL_METRIC_KEYS = Object.freeze([
  "turns",
  "contextRebuilds",
  "fastPathCount",
  "partialRebuildCount",
  "fullRebuildCount",
  "inputTokens",
  "outputTokens",
  "totalTokens",
  "verification",
]);

/** Aggregate derived metric keys (spec: Derived Report Metrics). */
export const DERIVED_METRIC_KEYS = Object.freeze([
  "tokensPerRebuild",
  "tokensPerVerifiedTask",
  "rebuildReductionPct",
  "inputReductionPct",
  "totalReductionPct",
]);

/** Counters whose absence is read as 0 (kept in sync with the collector). */
const COUNTER_KEYS = COUNTER_NAMES;

const EMPTY_COUNTERS = Object.freeze(Object.fromEntries(COUNTER_KEYS.map((k) => [k, 0])));

/** Safe numeric read: missing/NaN/non-finite collapses to 0. */
const num = (value) => (Number.isFinite(value) ? value : 0);

/** Safe ratio: returns 0 when the denominator is 0 (never NaN/Infinity). */
const ratio = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

const round2 = (n) => Number(n.toFixed(2));

/**
 * Folds an optional raw collector (from `createCollector()`) into a plain counter map.
 * Accepts either a live collector (uses `.snapshot()`) or an already-plain snapshot.
 *
 * @param {object|null|undefined} collectorSnapshot
 * @returns {Record<string, number>}
 */
export function normalizeCounters(collectorSnapshot) {
  const raw =
    collectorSnapshot && typeof collectorSnapshot === "object"
      ? typeof collectorSnapshot.snapshot === "function"
        ? collectorSnapshot.snapshot()
        : collectorSnapshot
      : {};

  const merged = { ...EMPTY_COUNTERS };
  for (const key of COUNTER_KEYS) {
    merged[key] = num(raw[key]);
  }
  return merged;
}

/**
 * Rebuild counts are derived from a per-turn trace when the result carries one:
 *   rebuildScope "full"     -> full rebuild, 1 reconstruction
 *   rebuildScope "partial"  -> partial rebuild, 1 reconstruction
 *   rebuildScope "fast-path"-> 0 rebuilds, 1 fast path
 * Counters remain the fallback (single-shot scenarios) and are never summed on top of
 * the trace, so the two sources can never double count.
 */
function rebuildBreakdown(turnTrace, counters) {
  const hasTrace = Array.isArray(turnTrace) && turnTrace.length > 0;
  if (!hasTrace) {
    const partial = counters.Context_reconstructed - counters.Context_fast_path;
    return {
      rebuilds: counters.Context_reconstructed,
      fastPath: counters.Context_fast_path,
      partial: Math.max(0, partial),
      full: 0,
    };
  }

  let fastPath = 0;
  let partial = 0;
  let full = 0;
  for (const t of turnTrace) {
    if (t.rebuildScope === "full") full += 1;
    else if (t.rebuildScope === "partial") partial += 1;
    else if (t.rebuildScope === "fast-path") fastPath += 1;
  }
  return { rebuilds: partial + full, fastPath, partial, full };
}

/**
 * @typedef {object} ScenarioResult
 * @property {string} scenarioId
 * @property {string} family
 * @property {number} [turns]                       turn count (falls back to trace length)
 * @property {object} collectorSnapshot              collector counters (or live collector)
 * @property {Array<{ rebuildScope: string }>} [turnTrace] per-turn mechanism trace (optional)
 * @property {boolean|object|string} verification    verification state, preserved verbatim
 * @property {{ input: number, output: number, total: number }} [tokens]
 * @property {{ tokens: { total: number } }} [baseline]  no-WAM totals, for reduction %
 */

/**
 * @param {{ scenarioResults: ScenarioResult[] }} args
 * @returns {{ scenarios: Record<string, object>, byScenario: object[], totals: object }}
 */
export function computeCausalMetrics({ scenarioResults }) {
  const results = Array.isArray(scenarioResults) ? scenarioResults : [];

  const byScenario = results.map((result) => {
    const counters = normalizeCounters(result.collectorSnapshot);
    const { rebuilds, fastPath, partial, full } = rebuildBreakdown(result.turnTrace, counters);
    const tokens = result.tokens ?? {};

    const inputTokens = num(tokens.input);
    const outputTokens = num(tokens.output);
    const totalTokens = num(tokens.total) || inputTokens + outputTokens;

    return {
      scenarioId: result.scenarioId,
      family: result.family,
      // --- CAUSAL_METRIC_KEYS ---
      turns: num(result.turns ?? result.turnTrace?.length),
      contextRebuilds: rebuilds,
      fastPathCount: fastPath,
      partialRebuildCount: partial,
      fullRebuildCount: full,
      inputTokens,
      outputTokens,
      totalTokens,
      // Preserved as-is: never coerced to boolean, never dropped, never clamped.
      verification: result.verification,
      // --- supporting detail (not part of CAUSAL_METRIC_KEYS) ---
      counters,
      baselineTotalTokens: num(result.baseline?.tokens?.total),
    };
  });

  const scenarios = {};
  for (const entry of byScenario) {
    scenarios[entry.scenarioId] = entry;
  }

  const sum = (pick) => byScenario.reduce((acc, entry) => acc + pick(entry), 0);
  const isVerified = (state) =>
    state === true || state === "success" || state === "verified" || state === "pass" ||
    (state !== null && typeof state === "object" && state.success === true);

  const verifiedTasks = byScenario.filter((e) => isVerified(e.verification)).length;
  const sumTurns = sum((e) => e.turns);
  const sumRebuilds = sum((e) => e.contextRebuilds);
  const sumInput = sum((e) => e.inputTokens);
  const sumOutput = sum((e) => e.outputTokens);
  const sumTotal = sum((e) => e.totalTokens);
  const sumBaselineInput = sum((e) => e.baselineTotalTokens);
  const sumBaselineTotal = sumBaselineInput;

  // Rebuild reduction: potential rebuilds (one per turn) minus rebuilds actually performed.
  // NOT clamped: a negative value is a legitimate measurement.
  const rebuildReductionPct = ratio(sumTurns - sumRebuilds, sumTurns) * 100;

  // Input/total reduction: no-WAM totals minus WAM totals, over the no-WAM totals.
  // NOT clamped: negative families legitimately report negative reductions.
  const inputReductionPct = ratio(sumBaselineInput - sumInput, sumBaselineInput) * 100;
  const totalReductionPct = ratio(sumBaselineTotal - sumTotal, sumBaselineTotal) * 100;

  return {
    scenarios,
    byScenario,
    totals: {
      // --- DERIVED_METRIC_KEYS ---
      tokensPerRebuild: round2(ratio(sumTotal, sumRebuilds)),
      tokensPerVerifiedTask: round2(ratio(sumTotal, verifiedTasks)),
      rebuildReductionPct: round2(rebuildReductionPct),
      inputReductionPct: round2(inputReductionPct),
      totalReductionPct: round2(totalReductionPct),
      // supporting aggregates
      scenarioCount: byScenario.length,
      turns: sumTurns,
      contextRebuilds: sumRebuilds,
      fastPathCount: sum((e) => e.fastPathCount),
      partialRebuildCount: sum((e) => e.partialRebuildCount),
      fullRebuildCount: sum((e) => e.fullRebuildCount),
      inputTokens: sumInput,
      outputTokens: sumOutput,
      totalTokens: sumTotal,
      baselineTotalTokens: sumBaselineTotal,
      verifiedTasks,
    },
  };
}

/** Re-exported so callers can fold raw counters without importing the collector directly. */
export { createCollector };
