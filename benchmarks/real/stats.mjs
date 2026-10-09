/**
 * Pure statistical helpers for the real-benchmark trial aggregation layer.
 *
 * No external dependencies. Reuses the canonical primitives from
 * `benchmarks/evaluation/statistics.mjs` when available, then adds a thin
 * convenience layer (p95, percentiles, pValue) and a `summarize` helper that
 * matches the trial-aggregation contract used by `runRealSuite`.
 *
 * Conventions (mirrored from `benchmarks/evaluation/statistics.mjs`):
 * - All functions accept arrays of finite numbers; non-finite entries are ignored.
 * - `n < 2` cases return `null` for derived statistics (ci95, pValue).
 * - Sample stddev uses denominator n-1; `n < 2` yields 0.
 */

import {
  mean as _mean,
  median as _median,
  stddev as _stddev,
  quantile as _quantile,
  ci95 as _ci95,
  cohensD as _cohensD
} from "../evaluation/statistics.mjs";

export const mean = _mean;
export const median = _median;
export const stddev = _stddev;

/** Type-7 (linear-interpolation) percentile. `p` in [0,1]. */
export const percentile = _quantile;

/** Convenience: 95th percentile. */
export function p95(xs) {
  return _quantile(xs, 0.95);
}

/** 95% confidence interval around the mean (normal approximation). */
export const ci95 = _ci95;

/** Cohen's d (pooled, sample stddev) for effect size. */
export const cohenD = _cohensD;

/**
 * Welch's two-sample t-test p-value (two-sided).
 * Returns `null` when samples cannot be evaluated (n<2 in either, zero SE).
 */
export function pValue(a, b) {
  const cleanA = (Array.isArray(a) ? a : []).filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  const cleanB = (Array.isArray(b) ? b : []).filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (cleanA.length < 2 || cleanB.length < 2) return null;
  const ma = _mean(cleanA);
  const mb = _mean(cleanB);
  const va = _stddev(cleanA) ** 2;
  const vb = _stddev(cleanB) ** 2;
  const seSquared = va / cleanA.length + vb / cleanB.length;
  if (seSquared <= 0) return null;
  const t = (ma - mb) / Math.sqrt(seSquared);
  // Welch–Satterthwaite df
  const dfNum = seSquared ** 2;
  const dfDen =
    (va * va) / (cleanA.length * cleanA.length * (cleanA.length - 1)) +
    (vb * vb) / (cleanB.length * cleanB.length * (cleanB.length - 1));
  if (dfDen <= 0) return null;
  const df = dfNum / dfDen;
  return twoSidedStudentTP(t, df);
}

/**
 * Two-sided Student-t p-value from t statistic and degrees of freedom.
 * Uses the incomplete-beta representation via a continued-fraction expansion
 * of the regularized incomplete beta function. Self-contained, no deps.
 */
function twoSidedStudentTP(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return null;
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const ibeta = incompleteBeta(x, a, b);
  if (ibeta == null) return null;
  return Math.min(1, Math.max(0, ibeta));
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Use the regularized incomplete beta via continued fraction (Lentz's method).
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) +
    b * Math.log(1 - x)
  );
  if (!Number.isFinite(bt) || bt === 0) return x < (a + 1) / (a + b + 2) ? 0 : 1;
  // Symmetry: I_x(a,b) = 1 - I_{1-x}(b,a)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }
  const cf = continuedFraction(x, a, b);
  return (bt * cf) / a;
}

function continuedFraction(x, a, b) {
  const MAX_ITER = 200;
  const EPS = 3e-12;
  let f = 1;
  let c = 1;
  let d = 0;
  for (let i = 0; i < MAX_ITER; i += 1) {
    const m = i / 2;
    let numerator;
    if (i === 0) numerator = 1;
    else if (i % 2 === 0) numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    else numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = c * d;
    f *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return f;
}

/** Lanczos approximation for log-gamma. */
function logGamma(z) {
  if (!Number.isFinite(z) || z <= 0) return 0;
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) {
    // Reflection
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i += 1) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Summarize an array of per-trial numbers into the trialStats shape used by
 * the report. `n < 1` returns `null` so callers can distinguish "no trials"
 * from "trials aggregated to zero".
 */
export function summarize(xs) {
  const data = (Array.isArray(xs) ? xs : []).filter(
    (v) => typeof v === "number" && Number.isFinite(v)
  );
  if (data.length === 0) return null;
  const ci = _ci95(data);
  return {
    n: data.length,
    mean: _mean(data),
    median: _median(data),
    p95: _quantile(data, 0.95),
    stddev: _stddev(data),
    ci95: ci && ci.length === 2 ? { low: ci[0], high: ci[1] } : null
  };
}
