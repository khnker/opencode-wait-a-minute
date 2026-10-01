/**
 * @typedef {Object} RunResult
 * @property {string} scenario
 * @property {number} run
 * @property {number} turn
 * @property {string} model
 * @property {string} provider
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {number} contextTokens
 * @property {number} wamOverheadTokens
 * @property {number} contextRebuilds
 * @property {number} fastPathCount
 * @property {number} partialRebuildCount
 * @property {number} fullRebuildCount
 * @property {Object} verification
 */

import { EMPIRICAL_EVIDENCE } from "../reporters/claims.mjs";
import { stateEquivalent } from "./state-equivalence.mjs";

export const RunResultFields = [
  "scenario", "run", "turn", "trialId", "pairId", "model", "provider",
  "inputTokens", "outputTokens",
  "totalTokens", "contextTokens", "wamOverheadTokens", "contextRebuilds",
  "fastPathCount", "partialRebuildCount", "fullRebuildCount", "verification",
  "ablation"
];

const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function deriveRebuilds(turn) {
  const trace = turn?.wam?.turnTrace;
  if (trace) {
    const partial = num(trace.partialRebuildCount ?? trace.partial);
    const full = num(trace.fullRebuildCount ?? trace.full);
    const fast = num(trace.fastPathCount ?? trace.fast);
    return {
      fastPathCount: fast,
      partialRebuildCount: partial,
      fullRebuildCount: full,
      contextRebuilds: partial + full
    };
  }
  const counters = turn?.wam?.counters ?? {};
  const fullRebuildCount = num(counters.Reconstruction_count);
  return {
    fastPathCount: num(counters.Context_fast_path),
    partialRebuildCount: 0,
    fullRebuildCount,
    contextRebuilds: fullRebuildCount
  };
}

/**
 * Maps a `runRealScenario` session result into per-turn `RunResult` records.
 *
 * `inputTokens` is the WAM arm's effective input: the assembled task context
 * (`Tokens_after`). `wamOverheadTokens` is the remainder of the provider-charged
 * input beyond that context, so `inputTokens + wamOverheadTokens` equals the
 * largest of (assembled context, provider-reported input) and never
 * double-counts provider framing.
 */
export function normalizeRuns(sessionResult, { model, provider, verification } = {}) {
  const turns = sessionResult?.turns ?? [];
  const trialId = num(sessionResult?.trialId ?? 0);
  const pairId = sessionResult?.pairId || `${sessionResult?.scenarioId ?? ""}#${trialId}`;
  return turns.map((turn, index) => {
    const baselineUsage = turn?.baseline?.usage ?? {};
    const wamUsage = turn?.wam?.usage ?? {};
    const counters = turn?.wam?.counters ?? {};

    const contextTokens = num(counters.Tokens_after);
    const wamModelInput = num(wamUsage.inputTokens);
    const wamOverheadTokens = Math.max(0, wamModelInput - contextTokens);
    const inputTokens = contextTokens;
    const outputTokens = num(wamUsage.outputTokens);
    const baselineInputTokens = num(baselineUsage.inputTokens);
    const baselineOutputTokens = num(baselineUsage.outputTokens);
    const { fastPathCount, partialRebuildCount, fullRebuildCount, contextRebuilds } = deriveRebuilds(turn);

    return {
      scenario: sessionResult.scenarioId,
      run: num(sessionResult.run),
      trialId,
      pairId,
      turn: typeof turn.turnIndex === "number" ? turn.turnIndex : index,
      model: model ?? turn?.wam?.model ?? "unknown",
      provider: provider ?? "unknown",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + wamOverheadTokens + outputTokens,
      contextTokens,
      wamOverheadTokens,
      contextRebuilds,
      fastPathCount,
      partialRebuildCount,
      fullRebuildCount,
      verification: verification ?? null,
      snapshotStatus: turn?.wam?.snapshotStatus ?? null,
      changedSignals: Array.isArray(turn?.wam?.changedSignals) ? turn.wam.changedSignals : [],
      rebuildScope: turn?.wam?.rebuildScope ?? null,
      fastPath: Boolean(turn?.wam?.fastPath),
      baselineInputTokens,
      baselineOutputTokens,
      baselineTotalTokens: baselineInputTokens + baselineOutputTokens,
      wamInputTokens: wamModelInput,
      wamOutputTokens: outputTokens,
      wamTotalTokens: wamModelInput + outputTokens,
      logicalStateHash: turn?.wam?.logicalStateHash ?? turn?.baseline?.logicalStateHash ?? null,
      stateEquivalent: turn?.stateEquivalent ?? (
        turn?.baseline?.logicalStateHash != null && turn?.wam?.logicalStateHash != null
          ? stateEquivalent(turn.baseline.logicalStateHash, turn.wam.logicalStateHash)
          : true
      ),
      ablation: sessionResult.ablation ?? "full"
    };
  });
}

const wamEffectiveInput = (r) => r.inputTokens + r.wamOverheadTokens;

export function compareRuns({ runs }) {
  const totals = runs.reduce(
    (acc, r) => {
      acc.turns += 1;
      acc.baselineInputTokens += r.baselineInputTokens;
      acc.baselineOutputTokens += r.baselineOutputTokens;
      acc.wamInputTokens += r.inputTokens;
      acc.wamOverheadTokens += r.wamOverheadTokens;
      acc.wamOutputTokens += r.outputTokens;
      acc.contextTokens += r.contextTokens;
      acc.contextRebuilds += r.contextRebuilds;
      acc.fastPathCount += r.fastPathCount;
      acc.partialRebuildCount += r.partialRebuildCount;
      acc.fullRebuildCount += r.fullRebuildCount;
      if (r.stateEquivalent === false) {
        acc.nonEquivalentTurns += 1;
      }
      return acc;
    },
    {
      turns: 0, baselineInputTokens: 0, baselineOutputTokens: 0,
      wamInputTokens: 0, wamOverheadTokens: 0, wamOutputTokens: 0, contextTokens: 0,
      contextRebuilds: 0, fastPathCount: 0, partialRebuildCount: 0, fullRebuildCount: 0,
      nonEquivalentTurns: 0
    }
  );

  const netInputSavings = totals.baselineInputTokens - (totals.wamInputTokens + totals.wamOverheadTokens);
  const perScenario = {};
  for (const r of runs) {
    const s = (perScenario[r.scenario] ??= {
      scenario: r.scenario, turns: 0, baselineInputTokens: 0, wamInputTokens: 0,
      wamOverheadTokens: 0, contextRebuilds: 0, fastPathCount: 0,
      partialRebuildCount: 0, fullRebuildCount: 0, netInputSavings: 0
    });
    s.turns += 1;
    s.baselineInputTokens += r.baselineInputTokens;
    s.wamInputTokens += r.inputTokens;
    s.wamOverheadTokens += r.wamOverheadTokens;
    s.contextRebuilds += r.contextRebuilds;
    s.fastPathCount += r.fastPathCount;
    s.partialRebuildCount += r.partialRebuildCount;
    s.fullRebuildCount += r.fullRebuildCount;
    s.netInputSavings = s.baselineInputTokens - (s.wamInputTokens + s.wamOverheadTokens);
  }

  const pairs = {};
  for (const r of runs) {
    const key = r.pairId || `${r.scenario}#${r.trialId ?? 0}`;
    const p = (pairs[key] ??= {
      pairId: key,
      scenario: r.scenario,
      trialId: num(r.trialId ?? 0),
      turns: 0,
      baselineInputTokens: 0,
      wamInputTokens: 0,
      wamOverheadTokens: 0,
      netInputSavings: 0
    });
    p.turns += 1;
    p.baselineInputTokens += r.baselineInputTokens;
    p.wamInputTokens += r.inputTokens;
    p.wamOverheadTokens += r.wamOverheadTokens;
    p.netInputSavings = p.baselineInputTokens - (p.wamInputTokens + p.wamOverheadTokens);
  }

  const continuation = runs
    .filter((r) => r.scenario.startsWith("continuation"))
    .sort((a, b) => a.turn - b.turn);

  let cumulative = 0;
  let breakEvenTurn = null;
  for (const r of continuation) {
    cumulative += r.baselineInputTokens - wamEffectiveInput(r);
    if (breakEvenTurn === null && cumulative >= 0) {
      breakEvenTurn = r.turn;
    }
  }

  return {
    runs,
    perScenario,
    pairs,
    totals: {
      ...totals,
      wamEffectiveInput: totals.wamInputTokens + totals.wamOverheadTokens,
      netInputSavings,
      stateEquivalent: totals.nonEquivalentTurns === 0,
      trials: Object.keys(pairs).length
    },
    netInputSavings,
    breakEvenTurn
  };
}

export function buildRealReport({ sessionResults, model, provider, evidence = EMPIRICAL_EVIDENCE }) {
  const runs = (sessionResults ?? []).flatMap((sessionResult) =>
    normalizeRuns(sessionResult, { model, provider })
  );
  const comparison = compareRuns({ runs });

  return {
    version: "1.0.0",
    model,
    provider,
    runs: comparison.runs,
    perScenario: comparison.perScenario,
    pairs: comparison.pairs,
    totals: comparison.totals,
    netInputSavings: comparison.netInputSavings,
    breakEvenTurn: comparison.breakEvenTurn,
    benchmarkValid: comparison.totals.stateEquivalent,
    evidence
  };
}
