/**
 * Token telemetry for the RC1 paired-LLM experiment.
 *
 * Critical distinction enforced here: `cachedInputTokens` is provider-side
 * prompt caching and is NEVER mixed into WAM's algorithmic input-token
 * reduction. See benchmarks/real/protocol.md rule 4 (Metric Isolation).
 */

/** Coerce anything to a finite non-negative number, defaulting to 0. */
function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalize a provider completion's usage into a stable telemetry shape.
 * All fields default to 0 so downstream math never sees undefined/NaN.
 *
 * @param {Object} [result] provider completion result
 * @returns {{inputTokens: number, outputTokens: number, totalTokens: number, cachedInputTokens: number}}
 */
export function extractUsage(result) {
  const usage = result?.usage ?? {};
  const inputTokens = safeNumber(usage.inputTokens);
  const outputTokens = safeNumber(usage.outputTokens);
  const cachedInputTokens = safeNumber(usage.cachedInputTokens);
  const totalTokens = Number.isFinite(Number(usage.totalTokens))
    ? safeNumber(usage.totalTokens)
    : inputTokens + outputTokens;

  return { inputTokens, outputTokens, totalTokens, cachedInputTokens };
}

/**
 * WAM's algorithmic input-token reduction between the baseline arm and the
 * WAM arm. Provider cache savings are excluded by construction: this is a
 * pure inputTokens comparison.
 *
 * @param {{baseline: number, input: number}} args
 * @returns {{absolute: number, pct: number}} pct is 0 when baseline is 0
 */
export function wamInputReduction({ baseline, input }) {
  const baselineTokens = safeNumber(baseline);
  const wamTokens = safeNumber(input);
  const absolute = baselineTokens - wamTokens;
  // Guard division by zero: an empty baseline has no meaningful percentage.
  const pct = baselineTokens === 0 ? 0 : (absolute / baselineTokens) * 100;
  return { absolute, pct };
}
