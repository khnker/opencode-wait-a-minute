export function computeMetrics({ results, evaluations }) {
  const totalTurns = results.reduce((n, r) => n + r.turns.length, 0);
  const sumWamTokens = results.reduce((n, r) => n + r.totals.wamTokens, 0);
  const sumBaselineTokens = results.reduce((n, r) => n + r.totals.baselineTokens, 0);
  const sumContextReconstructed = results.reduce((n, r) => n + (r.counters.Context_reconstructed || 0), 0);
  const sumContextFastPath = results.reduce((n, r) => n + (r.counters.Context_fast_path || 0), 0);

  const successfulTasks = evaluations.filter(e => e.success).length;
  const numEvaluations = evaluations.length || 1;

  const sumWamOverheadTokens = results.reduce((n, r) => n + (r.wamOverheadTokens || 0), 0);

  // Three distinct savings figures, all as a percentage of baseline input tokens.
  // Mirrors benchmarks/evaluation/ablation.mjs:
  //   netInputSavings = baselineInputTokens - (wamInputTokens + wamOverheadTokens)
  // context_reduction is the raw saving before WAM overhead; wam_overhead is the
  // cost WAM itself adds; net_input_savings is the actual gain and may be negative.
  const contextReductionPct = sumBaselineTokens > 0
    ? ((sumBaselineTokens - sumWamTokens) / sumBaselineTokens) * 100
    : 0;
  const wamOverheadPct = sumBaselineTokens > 0
    ? (sumWamOverheadTokens / sumBaselineTokens) * 100
    : 0;
  const netInputSavingsPct = sumBaselineTokens > 0
    ? ((sumBaselineTokens - (sumWamTokens + sumWamOverheadTokens)) / sumBaselineTokens) * 100
    : 0;

  const SuccessRate = (successfulTasks / numEvaluations) * 100;
  const EquivalenceRate = (evaluations.filter(e => e.equivalent).length / numEvaluations) * 100;

  const ReconstructionReductionPct = totalTurns > 0
    ? ((totalTurns - sumContextReconstructed) / totalTurns) * 100
    : 0;

  const FastPathRate = totalTurns > 0
    ? (sumContextFastPath / totalTurns) * 100
    : 0;

  const TokensPerSuccessfulTask = successfulTasks > 0
    ? (sumWamTokens / successfulTasks)
    : 0;

  // Verification-based correctness: success is driven by completionAllowed
  // when correctnessSource === "verification", otherwise fall back to legacy success.
  const verificationCorrectCount = evaluations.filter(e =>
    e.correctnessSource === "verification" ? e.completionAllowed === true : e.success === true
  ).length;
  const VerificationRate = (verificationCorrectCount / numEvaluations) * 100;

  const correctnessSource = evaluations.reduce(
    (acc, e) => {
      const key = e.correctnessSource === "verification" ? "verification" : "fallback";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { verification: 0, fallback: 0 }
  );

  return {
    context_reduction: Number(contextReductionPct.toFixed(2)),
    wam_overhead: Number(wamOverheadPct.toFixed(2)),
    net_input_savings: Number(netInputSavingsPct.toFixed(2)),
    SuccessfulTasks: successfulTasks,
    SuccessRate: Number(SuccessRate.toFixed(2)),
    EquivalenceRate: Number(EquivalenceRate.toFixed(2)),
    ReconstructionReductionPct: Number(ReconstructionReductionPct.toFixed(2)),
    FastPathRate: Number(FastPathRate.toFixed(2)),
    TokensPerSuccessfulTask: Number(TokensPerSuccessfulTask.toFixed(2)),
    VerificationRate: Number(VerificationRate.toFixed(2)),
    correctnessSource
  };
}