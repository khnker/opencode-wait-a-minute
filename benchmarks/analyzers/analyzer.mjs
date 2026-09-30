export const ANALYZER_VERSION = "1.0.0";
export function analyzeTrace(trace) {
  const turns = trace.turns.length;
  const inputTokens = trace.turns.reduce((a, b) => a + b.inputTokens, 0);
  const outputTokens = trace.turns.reduce((a, b) => a + b.outputTokens, 0);
  const totalTokens = inputTokens + outputTokens;
  const toolCalls = trace.turns.reduce((a, b) => a + b.toolCalls, 0);
  const contextRebuilds = trace.turns.filter(t => t.contextRebuilt).length;
  const verifiedRequirements = trace.progress.requirementsVerified;
  const totalRequirements = trace.progress.totalRequirements;
  const verifiedProgress = totalRequirements > 0 ? verifiedRequirements / totalRequirements : 0;
  const verifiedProgressPer1kInputTokens = inputTokens > 0 ? Number((verifiedProgress / (inputTokens / 1000)).toFixed(4)) : 0;
  return { runId: trace.runId, scenarioId: trace.scenarioId, condition: trace.condition, mode: trace.mode, tokenSource: trace.turns[0].tokenSource, inputTokens, outputTokens, totalTokens, turns, toolCalls, contextRebuilds, verifiedRequirements, totalRequirements, verifiedProgress, verifiedProgressPer1kInputTokens, completionStatus: trace.progress.finalState, provenance: trace.provenance, model: trace.model };
}
export function evaluatePair(baselineTrace, wamTrace) {
  const b = analyzeTrace(baselineTrace);
  const w = analyzeTrace(wamTrace);
  const inputSavingsPct = Number(((b.inputTokens - w.inputTokens) / b.inputTokens * 100).toFixed(2));
  const totalSavingsPct = Number(((b.totalTokens - w.totalTokens) / b.totalTokens * 100).toFixed(2));
  return { scenarioId: b.scenarioId, baseline: b, wam: w, savings: { inputTokens: b.inputTokens - w.inputTokens, inputSavingsPct, totalTokens: b.totalTokens - w.totalTokens, totalSavingsPct } };
}
export function summarizeSamples(values) {
  if (values.length === 0) return { min: null, p25: null, median: null, p75: null, max: null, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const getP = (p) => { const idx = p * (sorted.length - 1); const lower = Math.floor(idx); const upper = Math.ceil(idx); const w = idx - lower; return sorted[lower] * (1 - w) + sorted[upper] * w; };
  return { min: sorted[0], p25: getP(0.25), median: getP(0.5), p75: getP(0.75), max: sorted[sorted.length - 1], n: sorted.length };
}
export function summarizeRepeated(pairs) {
  const input = pairs.map(p => p.savings.inputSavingsPct);
  const total = pairs.map(p => p.savings.totalSavingsPct);
  return { inputSavingsPct: summarizeSamples(input), totalSavingsPct: summarizeSamples(total) };
}
