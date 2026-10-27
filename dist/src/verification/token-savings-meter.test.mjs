delete process.env.WAM_METRICS_DIR;
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  estimateTokens,
  estimateMonolithicBaseline,
  calculateTokenSavings,
  recordTokenSavings,
  getTokenSavingsReport,
  summarizeTokenSavings
} from "./token-savings-meter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "..", "..", "tmp", "test-token-savings");

test("estimateTokens returns 0 for empty/null input", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
});

test("estimateTokens calculates chars/4 rounded up", () => {
  assert.equal(estimateTokens("a".repeat(4)), 1);
  assert.equal(estimateTokens("a".repeat(5)), 2);
  assert.equal(estimateTokens("a".repeat(400)), 100);
});

test("estimateTokens accepts a calibrated charsPerToken", () => {
  assert.equal(estimateTokens("a".repeat(320), { charsPerToken: 3.2 }), 100);
  assert.equal(estimateTokens("a".repeat(400), { charsPerToken: 0 }), 100);
});

test("estimateMonolithicBaseline applies multiplier", () => {
  assert.equal(estimateMonolithicBaseline(200), 6000);
  assert.equal(estimateMonolithicBaseline(200, 500), 6500);
  assert.equal(estimateMonolithicBaseline(0), 6000);
});

test("calculateTokenSavings returns correct percentage", () => {
  assert.equal(calculateTokenSavings(53, 1500), 96);
  assert.equal(calculateTokenSavings(750, 1500), 50);
  assert.equal(calculateTokenSavings(1500, 1500), 0);
  assert.equal(calculateTokenSavings(2000, 1500), 0);
});

test("calculateTokenSavings returns 0 for invalid baseline", () => {
  assert.equal(calculateTokenSavings(100, 0), 0);
  assert.equal(calculateTokenSavings(100, -1), 0);
});

test("recordTokenSavings persists metrics to .wam/metrics/token-savings.json", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const record = recordTokenSavings(TMP_DIR, "task-1", 53, 50);

  assert.equal(record.taskId, "task-1");
  assert.equal(record.actualTokens, 53);
  assert.ok(record.baselineTokens > 0);
  assert.equal(record.baselineSource, "synthetic");
  assert.equal(record.savingsPct, null);
  assert.equal(record.savingsTokens, 0);
  assert.ok(record.deltaTokens > 0);
  assert.equal(record.estimator, "chars/4");

  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 1);
  assert.equal(report[0].taskId, "task-1");

  const record2 = recordTokenSavings(TMP_DIR, "task-1", 100, 50);
  assert.equal(record2.taskId, "task-1");

  const report2 = getTokenSavingsReport(TMP_DIR);
  assert.equal(report2.length, 2);

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("measured baselines produce numeric savings and preserve negative deltas", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const measured = recordTokenSavings(TMP_DIR, "task-m", 100, {
    promptTokens: 100,
    baselineTokens: 1000,
    baselineSource: "measured",
    actualRequestTokens: 100,
    usageSource: "provider",
  });
  assert.equal(measured.baselineSource, "measured");
  assert.equal(measured.claimable, true);
  assert.equal(measured.savingsPct, 90);
  assert.equal(measured.savingsTokens, 900);

  const negative = recordTokenSavings(TMP_DIR, "task-neg", 1200, {
    baselineTokens: 1000,
    baselineSource: "measured",
    actualRequestTokens: 1200,
    usageSource: "provider",
  });
  assert.equal(negative.savingsPct, 0);
  assert.equal(negative.savingsTokens, 0);
  assert.equal(negative.deltaTokens, -200);

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("measured baseline without provider usage is not claimable", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const noUsage = recordTokenSavings(TMP_DIR, "task-no-usage", 100, {
    baselineTokens: 1000,
    baselineSource: "measured",
  });
  assert.equal(noUsage.claimable, false);
  assert.equal(noUsage.savingsPct, null);
  assert.equal(noUsage.actualRequestTokens, null);

  const noBaseline = recordTokenSavings(TMP_DIR, "task-no-baseline", 100, {
    actualRequestTokens: 500,
    usageSource: "provider",
  });
  assert.equal(noBaseline.claimable, false);
  assert.equal(noBaseline.savingsPct, null);

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("retention drops synthetic records before claimable ones", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  recordTokenSavings(TMP_DIR, "claimable", 10, {
    maxRecords: 2, baselineTokens: 100, baselineSource: "measured",
    actualRequestTokens: 50, usageSource: "provider",
  });
  recordTokenSavings(TMP_DIR, "synthetic-1", 10, { maxRecords: 2 });
  recordTokenSavings(TMP_DIR, "synthetic-2", 10, { maxRecords: 2 });
  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 2);
  assert.ok(report.some((r) => r.taskId === "claimable"), "la evidencia reclamable sobrevive");
  assert.deepEqual(report.map((r) => r.taskId), ["claimable", "synthetic-2"]);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("recordTokenSavings keeps the metrics file bounded", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  for (let i = 0; i < 5; i++) {
    recordTokenSavings(TMP_DIR, `task-${i}`, 10, { maxRecords: 3 });
  }
  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 3);
  assert.deepEqual(report.map((r) => r.taskId), ["task-2", "task-3", "task-4"]);

  const archive = fs.readFileSync(path.join(TMP_DIR, ".wam", "metrics", "token-savings-archive.jsonl"), "utf-8").trim().split("\n");
  assert.equal(archive.length, 2);
  assert.equal(JSON.parse(archive[0]).taskId, "task-0");

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("WAM_METRICS_DIR redirects writes away from the project", () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync("."), "tmp", "metrics-root-"));
  const dir = fs.mkdtempSync(path.join(fs.realpathSync("."), "tmp", "metrics-out-"));
  const previous = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = dir;
  try {
    recordTokenSavings(root, "task-redirect", 10, { promptTokens: 5 });
    assert.equal(fs.existsSync(path.join(root, ".wam", "metrics", "token-savings.json")), false);
    assert.equal(fs.existsSync(path.join(dir, "token-savings.json")), true);
  } finally {
    if (previous === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = previous;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("getTokenSavingsReport returns empty array for missing dir", () => {
  assert.deepEqual(getTokenSavingsReport("/nonexistent/path/xyz"), []);
});

test("recordTokenSavings returns null for missing params", () => {
  assert.equal(recordTokenSavings(null, "t1", 10, 5), null);
  assert.equal(recordTokenSavings(TMP_DIR, null, 10, 5), null);
});

test("recordTokenSavings coalesces identical measurements inside the window", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const opts = { promptTokens: 50, dedupeMs: 60000 };
  const first = recordTokenSavings(TMP_DIR, "continuation-x", 120, opts);
  const second = recordTokenSavings(TMP_DIR, "continuation-x", 120, opts);
  assert.equal(second.coalesced, true);
  assert.equal(first.coalesced, undefined);
  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 1, "una sola fila para dos mediciones idénticas");
  assert.equal(report[0].occurrences, 2);
  assert.ok(report[0].lastAt >= report[0].firstAt);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("recordTokenSavings does not coalesce with a zero window or a different task", () => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  recordTokenSavings(TMP_DIR, "a", 120, { promptTokens: 50, dedupeMs: 0 });
  recordTokenSavings(TMP_DIR, "a", 120, { promptTokens: 50, dedupeMs: 0 });
  recordTokenSavings(TMP_DIR, "b", 120, { promptTokens: 50, dedupeMs: 60000 });
  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 3);
  assert.deepEqual(report.map((r) => r.occurrences), [1, 1, 1]);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("summarizeTokenSavings separates claimable savings from the raw total", () => {
  const summary = summarizeTokenSavings([
    { savingsTokens: 900, claimable: true, occurrences: 2 },
    { savingsTokens: 0, claimable: false, occurrences: 5 },
    { savingsTokens: 0, claimable: false },
  ]);
  assert.deepEqual(summary, {
    total: 900,
    claimableTotal: 900,
    claimableCount: 1,
    unclaimableCount: 2,
    occurrences: 8,
  });
  assert.deepEqual(summarizeTokenSavings(null), {
    total: 0, claimableTotal: 0, claimableCount: 0, unclaimableCount: 0, occurrences: 0,
  });
});
