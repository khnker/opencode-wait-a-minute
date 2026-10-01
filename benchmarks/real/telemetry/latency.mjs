/**
 * Latency telemetry for the RC1 paired-LLM experiment.
 */

/** Coerce anything to a finite non-negative number, defaulting to 0. */
function safeMs(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Latency delta between the baseline arm and the WAM arm.
 * Positive `absolute` means WAM was faster than baseline.
 *
 * @param {{baselineMs: number, wamMs: number}} args
 * @returns {{absolute: number, pct: number}} pct is 0 when baselineMs is 0
 */
export function latencyDelta({ baselineMs, wamMs }) {
  const baseline = safeMs(baselineMs);
  const wam = safeMs(wamMs);
  const absolute = baseline - wam;
  // Guard division by zero: a 0ms baseline gives no meaningful percentage.
  const pct = baseline === 0 ? 0 : (absolute / baseline) * 100;
  return { absolute, pct };
}
