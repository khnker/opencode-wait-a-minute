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
  getTokenSavingsReport
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
  assert.ok(record.savingsPct > 0);
  assert.ok(record.savingsTokens > 0);

  const report = getTokenSavingsReport(TMP_DIR);
  assert.equal(report.length, 1);
  assert.equal(report[0].taskId, "task-1");

  const record2 = recordTokenSavings(TMP_DIR, "task-1", 100, 50);
  assert.equal(record2.taskId, "task-1");

  const report2 = getTokenSavingsReport(TMP_DIR);
  assert.equal(report2.length, 2);

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

test("getTokenSavingsReport returns empty array for missing dir", () => {
  assert.deepEqual(getTokenSavingsReport("/nonexistent/path/xyz"), []);
});

test("recordTokenSavings returns null for missing params", () => {
  assert.equal(recordTokenSavings(null, "t1", 10, 5), null);
  assert.equal(recordTokenSavings(TMP_DIR, null, 10, 5), null);
});
