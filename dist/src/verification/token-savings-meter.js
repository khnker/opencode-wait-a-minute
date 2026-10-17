import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASELINE_MULTIPLIER = 30;

export function estimateTokens(text) {
  if (!text || typeof text !== "string") return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMonolithicBaseline(promptTokens, historyTokens = 0) {
  const base = Math.max(promptTokens || 0, 200);
  return base * DEFAULT_BASELINE_MULTIPLIER + (historyTokens || 0);
}

export function calculateTokenSavings(actualTokens, baselineTokens) {
  if (!baselineTokens || baselineTokens <= 0) return 0;
  const saved = baselineTokens - actualTokens;
  if (saved <= 0) return 0;
  return Math.round((saved / baselineTokens) * 100);
}

export function recordTokenSavings(projectRoot, taskId, actualTokens, promptTokens, historyTokens = 0) {
  if (!projectRoot || !taskId) return null;

  const baselineTokens = estimateMonolithicBaseline(promptTokens, historyTokens);
  const savingsPct = calculateTokenSavings(actualTokens, baselineTokens);

  const record = {
    taskId,
    timestamp: Date.now(),
    actualTokens,
    baselineTokens,
    savingsPct,
    savingsTokens: baselineTokens - actualTokens
  };

  try {
    const metricsDir = path.join(projectRoot, ".wam", "metrics");
    fs.mkdirSync(metricsDir, { recursive: true });
    const filePath = path.join(metricsDir, "token-savings.json");
    let existing = [];
    if (fs.existsSync(filePath)) {
      try { existing = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { existing = []; }
    }
    existing.push(record);
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
  } catch {}

  return record;
}

export function getTokenSavingsReport(projectRoot) {
  if (!projectRoot) return [];
  try {
    const filePath = path.join(projectRoot, ".wam", "metrics", "token-savings.json");
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export function getLatestTokenSavings(projectRoot) {
  const records = getTokenSavingsReport(projectRoot);
  if (!Array.isArray(records) || records.length === 0) return null;
  return records[records.length - 1] || null;
}

export function printTokenSavingsSummary(projectRoot, logger = console) {
  const latest = getLatestTokenSavings(projectRoot);
  if (!latest) return false;
  const taskId = latest.taskId || "unknown";
  const pct = typeof latest.savingsPct === "number" ? latest.savingsPct : 0;
  const savedTokens = typeof latest.savingsTokens === "number" ? latest.savingsTokens : 0;
  const line = `[WAM Token Savings] Task ${taskId} saved ${pct}% tokens: ${savedTokens} tokens saved vs baseline`;
  if (logger && typeof logger.log === "function") {
    logger.log(line);
  } else {
    process.stdout.write(line + "\n");
  }
  return true;
}
