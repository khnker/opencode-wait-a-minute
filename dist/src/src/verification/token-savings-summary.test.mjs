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
    { taskId: "task-final", actualTokens: 50, baselineTokens: 5000, savingsPct: 99, savingsTokens: 4950, timestamp: 9 },
  ];
  seedMetrics(root, records);

  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  const ok = printTokenSavingsSummary(root, logger);

  assert.equal(ok, true);
  assert.equal(captured.length, 1);
  assert.equal(
    captured[0],
    "[WAM Token Savings] Task task-final saved 99% tokens: 4950 tokens saved vs baseline"
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

test("printTokenSavingsSummary works with a freshly recorded metric (round-trip)", () => {
  const root = freshDir();
  recordTokenSavings(root, "roundtrip", 120, 250, 0);

  const captured = [];
  const logger = { log: (line) => captured.push(line) };
  printTokenSavingsSummary(root, logger);

  assert.equal(captured.length, 1);
  assert.match(captured[0], /^\[WAM Token Savings\] Task roundtrip saved \d+% tokens: \d+ tokens saved vs baseline$/);
});

test("printTokenSavingsSummary falls back to stdout when logger lacks log", () => {
  const root = freshDir();
  const records = [
    { taskId: "stdout-fallback", actualTokens: 10, baselineTokens: 1000, savingsPct: 99, savingsTokens: 990, timestamp: 1 },
  ];
  seedMetrics(root, records);

  const ok = printTokenSavingsSummary(root, {});
  assert.equal(ok, true);
});