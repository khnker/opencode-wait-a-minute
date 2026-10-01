/**
 * Ablation configuration catalog and aggregation helpers.
 *
 * Each ablation toggles a single mechanism in `runRealScenario` so we can
 * isolate the contribution of snapshot fast-path, partial/full rebuild,
 * verification, and the context budget ceiling.
 *
 * - `full`              — no overrides; baseline behavior.
 * - `no_snapshot`       — disables the snapshot fast-path (every turn rebuilds).
 * - `no_rebuild`        — disables rebuildScope; the system must rely on snapshots.
 * - `unlimited_budget`  — removes the budget ceiling (budget = Infinity).
 * - `no_verification`   — disables verification-driven success (wam.verified = false).
 */

export const ABLATION_CONFIGS = {
  full: {},
  no_snapshot: { snapshot: false },
  no_rebuild: { rebuild: false },
  unlimited_budget: { budgetUnlimited: true },
  no_verification: { verification: false }
};

/**
 * Returns the canonical ordered list of `{name, config}` pairs. Order is
 * stable so that ablation indices and `trialId` mapping remain deterministic.
 */
export function listAblations() {
  return [
    { name: "full", config: ABLATION_CONFIGS.full },
    { name: "no_snapshot", config: ABLATION_CONFIGS.no_snapshot },
    { name: "no_rebuild", config: ABLATION_CONFIGS.no_rebuild },
    { name: "unlimited_budget", config: ABLATION_CONFIGS.unlimited_budget },
    { name: "no_verification", config: ABLATION_CONFIGS.no_verification }
  ];
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Aggregate a RunResult[] slice (from `normalizeRuns` / `buildRealReport`)
 * into the ablation summary shape used by the report's `ablation` field.
 *
 * Field semantics mirror `compareRuns({ runs }).totals` so the summary can be
 * compared directly across configurations.
 */
export function summarizeAblation(name, results) {
  const runs = Array.isArray(results) ? results : [];
  let baselineInputTokens = 0;
  let wamInputTokens = 0;
  let wamOverheadTokens = 0;
  let fastPathCount = 0;
  let verifiedCount = 0;

  for (const r of runs) {
    baselineInputTokens += num(r.baselineInputTokens);
    wamInputTokens += num(r.inputTokens);
    wamOverheadTokens += num(r.wamOverheadTokens);
    fastPathCount += r.fastPath === true ? 1 : num(r.fastPathCount);
    if (r.verification && typeof r.verification === "object") {
      if (r.verification.completionAllowed === true || r.verification.verified === true) {
        verifiedCount += 1;
      }
    } else if (r.verified === true) {
      verifiedCount += 1;
    }
  }

  const netInputSavings = baselineInputTokens - (wamInputTokens + wamOverheadTokens);
  const verifiedRate = runs.length > 0 ? verifiedCount / runs.length : 0;

  return {
    name,
    runs: runs.length,
    wamInputTokens,
    baselineInputTokens,
    wamOverheadTokens,
    netInputSavings,
    fastPathCount,
    verifiedRate
  };
}
