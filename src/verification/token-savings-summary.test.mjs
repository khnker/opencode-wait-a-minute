delete process.env.WAM_METRICS_DIR;
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLatestTokenSavings,
  printTokenSavingsSummary,
  recordTokenSavings,
} from "./token-savings-meter.js";

delete process.env.WAM_METRICS_DIR;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, "..", "..", "tmp", "test-token-savings-summary");

function freshDir() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  return TMP_DIR;
}

function seedMetrics(projectRoot, records) {
  const dir = path.join(projectRoot, ".wam", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "token-savings.json"), JSON.stringify(records, null, 2));
}

test("getLatestTokenSavings returns last record from token-savings.json", () => {
  const root = freshDir();
  const records = [
    { taskId: "task-a", actualTokens: 100, baselineTokens: 1000, savingsPct: 90, savingsTokens: 900, timestamp: 1 },
    { taskId: "task-b", actualTokens: 200, baselineTokens: 2000, savingsPct: 90, savingsTokens: 1800, timestamp: 2 },
  ];
  seedMetrics(root, records);

  const latest = getLatestTokenSavings(root);
  assert.ok(latest);
  assert.equal(latest.taskId, "task-b");
  assert.equal(latest.savingsTokens, 1800);
  assert.equal(latest.savingsPct, 90);
});

test("getLatestTokenSavings returns null when no metrics file exists", () => {
  const root = freshDir();
  assert.equal(getLatestTokenSavings(root), null);
});

test("getLatestTokenSavings returns null for non-array file content", () => {
  const root = freshDir();
  const dir = path.join(root, ".wam", "metrics");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "token-savings.json"), JSON.stringify({ not: "an array" }));
  assert.equal(getLatestTokenSavings(root), null);
});

test("printTokenSavingsSummary emits the expected summary line", () => {
  const root = freshDir();
  const records = [
    { taskId: "task-final", actualTokens: 50, actualRequestTokens: 50, usageSource: "provider", baselineTokens: 5000, baselineSource: "measured", claimable: true, savingsPct: 99, savingsTokens: 4950, timestamp: 9 },
  ];
  seedMetrics(root, records);

  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  const ok = printTokenSavingsSummary(root, logger);

  assert.equal(ok, true);
  assert.equal(captured.length, 1);
  assert.equal(
    captured[0],
    "[WAM Token Savings] Task task-final saved 99% tokens: 4950 tokens saved vs measured baseline (provider usage)"
  );
});

test("printTokenSavingsSummary returns false when there are no records", () => {
  const root = freshDir();
  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  const ok = printTokenSavingsSummary(root, logger);
  assert.equal(ok, false);
  assert.equal(captured.length, 0);
});

test("printTokenSavingsSummary does not claim synthetic savings", () => {
  const root = freshDir();
  recordTokenSavings(root, "synthetic", 120, { promptTokens: 250 });

  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  printTokenSavingsSummary(root, logger);

  assert.equal(captured.length, 1);
  assert.match(captured[0], /savings not claimed/);
  assert.doesNotMatch(captured[0], /saved \d+%/);
});

test("printTokenSavingsSummary works with a freshly recorded metric (round-trip)", () => {
  const root = freshDir();
  recordTokenSavings(root, "roundtrip", 120, { promptTokens: 250, baselineTokens: 750, baselineSource: "measured", actualRequestTokens: 600, usageSource: "provider" });

  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  printTokenSavingsSummary(root, logger);

  assert.equal(captured.length, 1);
  assert.match(captured[0], /^\[WAM Token Savings\] Task roundtrip saved \d+% tokens: \d+ tokens saved vs measured baseline \(provider usage\)$/);
});

test("printTokenSavingsSummary reports the last claimable record when a synthetic turn follows", () => {
  const root = freshDir();
  const records = [
    { taskId: "real", actualTokens: 120, actualRequestTokens: 600, usageSource: "provider", baselineTokens: 750, baselineSource: "measured", claimable: true, savingsPct: 20, savingsTokens: 150, timestamp: 1 },
    { taskId: "synthetic-later", actualTokens: 130, usageSource: "none", baselineSource: "synthetic", claimable: false, savingsPct: null, savingsTokens: 0, timestamp: 2 },
  ];
  seedMetrics(root, records);

  const captured = [];
  printTokenSavingsSummary(root, { log: (line) => captured.push(line) });

  assert.equal(captured.length, 1);
  assert.match(captured[0], /Task real saved 20%/);
  assert.doesNotMatch(captured[0], /not claimed/);
});

test("printTokenSavingsSummary falls back to stdout when logger lacks log", () => {
  const root = freshDir();
  const records = [
    { taskId: "stdout-fallback", actualTokens: 10, actualRequestTokens: 10, usageSource: "provider", baselineTokens: 1000, baselineSource: "measured", claimable: true, savingsPct: 99, savingsTokens: 990, timestamp: 1 },
  ];
  seedMetrics(root, records);

  const ok = printTokenSavingsSummary(root, {});
  assert.equal(ok, true);
});