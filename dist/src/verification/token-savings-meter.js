import fs from "node:fs";
import path from "node:path";

// Kept only as a rough reference. It is NOT evidence: no monolithic run is
// measured. Savings are claimed only from a caller-supplied baseline.
const DEFAULT_BASELINE_MULTIPLIER = 30;
const DEFAULT_CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_RECORDS = 1000;
const DEFAULT_DEDUPE_MS = 60000;

function resolveDedupeWindow(dedupeMs) {
  if (Number.isFinite(dedupeMs) && dedupeMs >= 0) return dedupeMs;
  const fromEnv = Number(process.env.WAM_METRICS_DEDUPE_MS);
  return Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_DEDUPE_MS;
}

function sameMeasurement(a, b) {
  return Boolean(a) && a.taskId === b.taskId &&
    a.actualTokens === b.actualTokens &&
    a.baselineTokens === b.baselineTokens &&
    a.baselineSource === b.baselineSource &&
    a.usageSource === b.usageSource;
}

function resolveMetricsDir(projectRoot, metricsDir) {
  return metricsDir || process.env.WAM_METRICS_DIR || path.join(projectRoot, ".wam", "metrics");
}

function metricsFilePath(projectRoot, metricsDir) {
  return path.join(resolveMetricsDir(projectRoot, metricsDir), "token-savings.json");
}

/**
 * Deterministic heuristic: ceil(chars / charsPerToken).
 * English prose averages ~4 chars/token; Spanish, JSON and code are denser
 * (~2.5-3.5), so callers can calibrate `charsPerToken`. No tokenizer dependency.
 */
export function estimateTokens(text, { charsPerToken = DEFAULT_CHARS_PER_TOKEN } = {}) {
  if (!text || typeof text !== "string") return 0;
  const ratio = Number.isFinite(charsPerToken) && charsPerToken > 0
    ? charsPerToken
    : DEFAULT_CHARS_PER_TOKEN;
  return Math.ceil(text.length / ratio);
}

export function estimateMonolithicBaseline(promptTokens, historyTokens = 0, { multiplier = DEFAULT_BASELINE_MULTIPLIER } = {}) {
  const base = Math.max(promptTokens || 0, 200);
  return base * multiplier + (historyTokens || 0);
}

export function calculateTokenSavings(actualTokens, baselineTokens) {
  if (!baselineTokens || baselineTokens <= 0) return 0;
  const saved = baselineTokens - actualTokens;
  if (saved <= 0) return 0;
  return Math.round((saved / baselineTokens) * 100);
}

/**
 * Record one measurement. A numeric 4th argument is accepted for backwards
 * compatibility and treated as `promptTokens`.
 *
 * Savings are only claimed when `baselineTokens` is supplied with
 * `baselineSource: "measured"`; otherwise the record is marked synthetic and
 * `savingsPct` is null.
 */
export function recordTokenSavings(projectRoot, taskId, actualTokens, options = {}, legacyHistoryTokens = 0) {
  if (!projectRoot || !taskId) return null;

  const opts = typeof options === "number"
    ? { promptTokens: options, historyTokens: legacyHistoryTokens }
    : (options || {});
  const {
    promptTokens = 0,
    historyTokens = 0,
    baselineTokens: suppliedBaseline,
    baselineSource = "synthetic",
    actualRequestTokens = null,
    usageSource = "none",
    maxRecords = DEFAULT_MAX_RECORDS,
    dedupeMs,
    estimator = `chars/${DEFAULT_CHARS_PER_TOKEN}`,
  } = opts;

  const hasMeasuredBaseline =
    baselineSource === "measured" &&
    Number.isFinite(suppliedBaseline) &&
    suppliedBaseline > 0;
  const hasUsageEvidence =
    usageSource === "provider" &&
    Number.isFinite(actualRequestTokens) &&
    actualRequestTokens > 0;
  const baselineTokens = hasMeasuredBaseline
    ? suppliedBaseline
    : estimateMonolithicBaseline(promptTokens, historyTokens);
  const claimable = hasMeasuredBaseline && hasUsageEvidence;
  const comparedTokens = hasUsageEvidence ? actualRequestTokens : actualTokens;
  const deltaTokens = baselineTokens - comparedTokens;
  const savingsPct = claimable
    ? calculateTokenSavings(actualRequestTokens, baselineTokens)
    : null;
  const savingsTokens = claimable ? Math.max(0, deltaTokens) : 0;

  const now = Date.now();
  const record = {
    taskId,
    timestamp: now,
    firstAt: now,
    lastAt: now,
    occurrences: 1,
    actualTokens,
    actualRequestTokens: hasUsageEvidence ? actualRequestTokens : null,
    usageSource: hasUsageEvidence ? "provider" : "none",
    promptTokens,
    baselineTokens,
    baselineSource: hasMeasuredBaseline ? "measured" : "synthetic",
    claimable,
    estimator,
    scope: "wam-injected-lines",
    savingsPct,
    savingsTokens,
    deltaTokens,
  };

  try {
    // Tests must not write to the project .wam; run-tests.mjs sets this to tmp.
    const metricsDir = resolveMetricsDir(projectRoot);
    fs.mkdirSync(metricsDir, { recursive: true });
    const filePath = path.join(metricsDir, "token-savings.json");
    let existing = [];
    if (fs.existsSync(filePath)) {
      try { existing = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { existing = []; }
    }
    if (!Array.isArray(existing)) existing = [];

    const windowMs = resolveDedupeWindow(dedupeMs);
    const last = existing[existing.length - 1];
    const lastAt = Number(last?.lastAt ?? last?.timestamp ?? 0);
    if (windowMs > 0 && sameMeasurement(last, record) && record.timestamp - lastAt <= windowMs) {
      last.occurrences = (Number(last.occurrences) || 1) + 1;
      last.lastAt = record.timestamp;
      last.firstAt = Number(last.firstAt ?? last.timestamp ?? record.timestamp);
      const tmpCoalesced = `${filePath}.tmp`;
      fs.writeFileSync(tmpCoalesced, JSON.stringify(existing, null, 2), "utf-8");
      fs.renameSync(tmpCoalesced, filePath);
      return { ...last, coalesced: true };
    }

    existing.push(record);
    const limit = Number.isFinite(maxRecords) && maxRecords > 0
      ? Math.floor(maxRecords)
      : DEFAULT_MAX_RECORDS;
    if (existing.length > limit) {
      // Evidence first: synthetic records are discarded before claimable ones.
      const overflow = existing.length - limit;
      const drop = new Set();
      for (let i = 0; i < existing.length && drop.size < overflow; i++) {
        if (existing[i]?.claimable !== true) drop.add(i);
      }
      for (let i = 0; i < existing.length && drop.size < overflow; i++) drop.add(i);
      const dropped = [...drop].sort((a, b) => a - b).map((i) => existing[i]);
      const archivePath = path.join(metricsDir, "token-savings-archive.jsonl");
      try {
        // Soft archive: never drop measurements without persisting them.
        fs.appendFileSync(
          archivePath,
          dropped.map((r) => JSON.stringify(r)).join("\n") + "\n",
          "utf-8",
        );
        existing = existing.filter((_, i) => !drop.has(i));
      } catch {
        // If the archive write fails, keep the file unbounded rather than lose data.
      }
    }

    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(existing, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch {}

  return record;
}

export function getTokenSavingsReport(projectRoot, { metricsDir } = {}) {
  if (!projectRoot) return [];
  try {
    const filePath = metricsFilePath(projectRoot, metricsDir);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export function getLatestTokenSavings(projectRoot, options = {}) {
  const records = getTokenSavingsReport(projectRoot, options);
  if (!Array.isArray(records) || records.length === 0) return null;
  return records[records.length - 1] || null;
}

/** Aggregates a metrics ledger without trusting unclaimable savings. */
export function summarizeTokenSavings(records = []) {
  const list = Array.isArray(records) ? records : [];
  let total = 0;
  let claimableTotal = 0;
  let claimableCount = 0;
  let occurrences = 0;
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const weight = Number(r.occurrences) > 0 ? Number(r.occurrences) : 1;
    total += Number(r.savingsTokens) > 0 ? Number(r.savingsTokens) : 0;
    occurrences += weight;
    if (r.claimable === true) {
      claimableTotal += Number(r.savingsTokens) > 0 ? Number(r.savingsTokens) : 0;
      claimableCount += 1;
    }
  }
  return { total, claimableTotal, claimableCount, unclaimableCount: list.length - claimableCount, occurrences };
}

export function printTokenSavingsSummary(projectRoot, logger = console) {
  const records = getTokenSavingsReport(projectRoot);
  const latest = records.length ? records[records.length - 1] : null;
  if (!latest) return false;

  // A later synthetic turn must not hide the last real measurement.
  const claimableRecord = [...records].reverse().find(
    (r) => r?.claimable === true && r?.usageSource === "provider" && typeof r?.savingsPct === "number",
  );
  const subject = claimableRecord || latest;
  const taskId = subject.taskId || "unknown";
  let line;
  if (subject === claimableRecord) {
    const savedTokens = typeof subject.savingsTokens === "number" ? subject.savingsTokens : 0;
    line = `[WAM Token Savings] Task ${taskId} saved ${subject.savingsPct}% tokens: ${savedTokens} tokens saved vs measured baseline (provider usage)`;
  } else {
    const actual = typeof latest.actualTokens === "number" ? latest.actualTokens : 0;
    line = `[WAM Token Savings] Task ${taskId}: savings not claimed (${actual} injected tokens, estimator=${latest.estimator || "unknown"}, usage=${latest.usageSource || "none"}, baseline=${latest.baselineSource || "synthetic"})`;
  }

  if (logger && typeof logger.log === "function") {
    logger.log(line);
  } else {
    process.stdout.write(line + "\n");
  }
  return true;
}
