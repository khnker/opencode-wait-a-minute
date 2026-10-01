/**
 * Pure statistical helpers — no external dependencies.
 *
 * Conventions:
 * - All functions accept arrays of finite numbers; non-finite entries are ignored.
 * - `n < 2` cases return `null` for derived statistics (ci95, pairedDelta with CI).
 * - Sample stddev uses denominator n-1; n < 2 yields 0.
 * - Welch's t-test uses an in-house Student-t CDF approximation (see `studentTCdf`).
 */

const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

function clean(xs) {
  if (!Array.isArray(xs)) return [];
  const out = [];
  for (const v of xs) {
    if (isFiniteNumber(v)) out.push(v);
  }
  return out;
}

export function mean(xs) {
  const data = clean(xs);
  if (data.length === 0) return 0;
  let s = 0;
  for (const v of data) s += v;
  return s / data.length;
}

export function stddev(xs) {
  const data = clean(xs);
  if (data.length < 2) return 0;
  const m = mean(data);
  let s = 0;
  for (const v of data) {
    const d = v - m;
    s += d * d;
  }
  return Math.sqrt(s / (data.length - 1));
}

export function median(xs) {
  const data = clean(xs);
  if (data.length === 0) return 0;
  const sorted = data.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Linear-interpolation quantile (type-7, Excel/R/numpy default).
 * `p` is in [0, 1]. Out-of-range or empty → 0.
 */
export function quantile(xs, p) {
  const data = clean(xs);
  if (data.length === 0) return 0;
  if (!isFiniteNumber(p)) return 0;
  const pp = Math.min(1, Math.max(0, p));
  if (data.length === 1) return data[0];
  const sorted = data.slice().sort((a, b) => a - b);
  const idx = pp * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * 95% confidence interval around the sample mean, assuming normality
 * (mean ± 1.96 * SE). Returns `null` when `n < 2` or stddev cannot be defined.
 */
export function ci95(xs) {
  const data = clean(xs);
  if (data.length < 2) {
    return { mean: data.length === 1 ? data[0] : 0, low: 0, high: 0, n: data.length };
  }
  const m = mean(data);
  const sd = stddev(data);
  const sem = sd / Math.sqrt(data.length);
  const half = 1.96 * sem;
  return { mean: m, low: m - half, high: m + half, n: data.length };
}

/**
 * In-house Student-t CDF using a regularized incomplete beta function.
 * Accurate to ~1e-7 for df > 0, which is sufficient for two-sided p-values.
 */
function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(x) {
  // Lanczos approximation (g=7, n=9)
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
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function regularizedBeta(x, a, b) {
  // Continued fraction (Numerical Recipes §6.4) — works for x < (a+1)/(a+b+2).
  if (x < 0 || x > 1) return 0;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = logBeta(a, b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  // Use the symmetry flip when x > (a+1)/(a+b+2) for faster convergence.
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedBeta(1 - x, b, a);
  }
  // Lentz's continued fraction
  const maxIter = 200;
  const eps = 1e-14;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return front * h;
}

function studentTCdf(t, df) {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
  // F(t|df) = 1 - 0.5 * I(df/(df + t^2); df/2, 1/2)
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/**
 * Welch's two-sample t-test (unequal variance). Returns `{t, df, p}` with
 * `p` being a two-sided p-value. When both samples have zero variance, returns
 * `{t: 0, df: 0, p: 1}` (no signal).
 */
export function welchTTest(a, b) {
  const A = clean(a);
  const B = clean(b);
  if (A.length < 2 || B.length < 2) {
    return { t: 0, df: 0, p: 1 };
  }
  const ma = mean(A);
  const mb = mean(B);
  const va = stddev(A) ** 2;
  const vb = stddev(B) ** 2;
  if (va === 0 && vb === 0) {
    return { t: 0, df: 0, p: 1 };
  }
  const se = Math.sqrt(va / A.length + vb / B.length);
  if (se === 0) {
    return { t: 0, df: 0, p: 1 };
  }
  const t = (ma - mb) / se;
  // Welch–Satterthwaite degrees of freedom
  const num = (va / A.length + vb / B.length) ** 2;
  const den =
    (va * va) / (A.length * A.length * (A.length - 1)) +
    (vb * vb) / (B.length * B.length * (B.length - 1));
  const df = den > 0 ? num / den : 0;
  const cdf = studentTCdf(t, df);
  const p = 2 * Math.min(cdf, 1 - cdf);
  return { t, df, p: Number.isFinite(p) ? p : 1 };
}

/**
 * Cohen's d (pooled, sample stddev). Returns 0 when both samples have zero
 * variance or when n < 2 in either.
 */
export function cohensD(a, b) {
  const A = clean(a);
  const B = clean(b);
  if (A.length < 2 || B.length < 2) return 0;
  const ma = mean(A);
  const mb = mean(B);
  const va = stddev(A) ** 2;
  const vb = stddev(B) ** 2;
  const sp = Math.sqrt(((A.length - 1) * va + (B.length - 1) * vb) / (A.length + B.length - 2));
  if (sp === 0) return 0;
  return (ma - mb) / sp;
}

/**
 * Paired comparison of `b - a`. Aligns by index, requires equal lengths.
 * Returns null if either array has fewer than 2 entries after cleaning.
 */
export function pairedDelta(a, b) {
  const A = clean(a);
  const B = clean(b);
  if (A.length < 2 || B.length < 2) return null;
  const n = Math.min(A.length, B.length);
  const deltas = [];
  for (let i = 0; i < n; i++) deltas.push(B[i] - A[i]);
  const meanDelta = mean(deltas);
  const medianDelta = median(deltas);
  const { low, high } = ci95(deltas);
  // Compare deltas against 0 (null hypothesis: no change)
  const zeros = new Array(n).fill(0);
  const welch = welchTTest(zeros, deltas);
  const d = cohensD(zeros, deltas);
  return {
    n,
    meanDelta,
    medianDelta,
    ci95: { low, high },
    cohensD: d,
    t: welch.t,
    p: welch.p
  };
}

/**
 * Compact summary of a single sample: count, mean, sample stddev,
 * median, and 95% CI bounds (when n >= 2).
 */
export function summarize(xs) {
  const data = clean(xs);
  const m = mean(data);
  const sd = stddev(data);
  const med = median(data);
  const ci = ci95(data);
  return {
    n: data.length,
    mean: m,
    stddev: sd,
    median: med,
    ci95: { low: ci.low, high: ci.high }
  };
}
