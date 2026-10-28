import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateShadowRecords } from "../../scripts/context-shadow-report.mjs";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/context-shadow-report.mjs",
);

function record(overrides = {}) {
  return {
    timestamp: "2026-10-28T00:00:00.000Z",
    mode: "shadow",
    budgetChars: 8000,
    injectedChars: 1000,
    shadowChars: 900,
    deltaChars: -100,
    injectedTokenEstimate: 250,
    shadowTokenEstimate: 225,
    requirements: { included: [], omitted: [], pending: [], conflicts: [] },
    projectionAvailable: true,
    fallbackReason: null,
    equivalent: false,
    ...overrides,
  };
}

function many(count, overrides = {}) {
  return Array.from({ length: count }, () => record(overrides));
}

function gate(result, name) {
  return result.gates.find((entry) => entry.name === name);
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-shadow-report-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

test("passes when every gate is satisfied", () => {
  const result = evaluateShadowRecords(many(20));
  assert.equal(result.pass, true);
  assert.equal(result.summary.count, 20);
  assert.equal(result.summary.equivalenceRate, 0);
  assert.equal(result.summary.omittedIds, 0);
});

test("fails when fewer than min-records are present", () => {
  const result = evaluateShadowRecords(many(19));
  assert.equal(result.pass, false);
  assert.equal(gate(result, "records").pass, false);
  assert.match(gate(result, "records").detail, /19 available record\(s\), minimum 20/);
});

test("corrupt line fails loud and names the line", () => {
  const lines = [JSON.stringify(record()), "{not json", JSON.stringify(record())];
  const result = evaluateShadowRecords(lines);
  assert.equal(result.pass, false);
  assert.equal(gate(result, "parse").pass, false);
  assert.match(gate(result, "parse").detail, /line 2:/);
});

test("self-contradictory selection fails", () => {
  const result = evaluateShadowRecords(
    many(20, { requirements: { included: ["req-1"], omitted: ["req-1"] } }),
  );
  assert.equal(result.pass, false);
  assert.equal(gate(result, "selection").pass, false);
  assert.match(gate(result, "selection").detail, /req-1/);
});

test("over-budget record fails", () => {
  const result = evaluateShadowRecords(many(20, { shadowChars: 8001 }));
  assert.equal(result.pass, false);
  assert.equal(gate(result, "budget").pass, false);
});

test("delta ratio breach fails", () => {
  const result = evaluateShadowRecords(
    many(20, { injectedChars: 100, shadowChars: 400, deltaChars: -300 }),
  );
  assert.equal(result.pass, false);
  assert.equal(gate(result, "delta").pass, false);
  assert.match(gate(result, "delta").detail, /3\.000/);
});

test("missing telemetry file exits 2", () =>
  withTempDir((dir) => {
    const result = runCli(["--file", path.join(dir, "missing.jsonl")]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /telemetry not found/);
  }));

test("clean telemetry file exits 0", () =>
  withTempDir((dir) => {
    const file = path.join(dir, "context-shadow.jsonl");
    fs.writeFileSync(file, `${many(20).map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const result = runCli(["--file", file]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /records: 20/);
    assert.match(result.stdout, /PASS/);
  }));

test("min-records counts only available projections", () => {
  const records = [
    ...many(19),
    record({ projectionAvailable: false, fallbackReason: "no-ledger-and-no-base" }),
  ];
  const result = evaluateShadowRecords(records);
  assert.equal(result.pass, false);
  assert.match(gate(result, "records").detail, /19 available record\(s\), minimum 20/);
  assert.equal(result.summary.available, 19);
  assert.equal(result.summary.fallback, 1);
});

test("fallback records never satisfy the minimum", () => {
  const result = evaluateShadowRecords(
    many(20, { projectionAvailable: false, fallbackReason: "no-ledger-and-no-base" }),
  );
  assert.equal(result.pass, false);
  assert.equal(result.summary.available, 0);
  assert.equal(result.summary.fallback, 20);
});

test("records without availability are unknown and never satisfy the minimum", () => {
  const result = evaluateShadowRecords(many(20, { projectionAvailable: undefined }));
  assert.equal(result.pass, false);
  assert.equal(result.summary.unknown, 20);
});

test("mixed legacy telemetry with unknown fields stays parseable", () => {
  const legacy = { ...record(), projectionAvailable: undefined, legacyExtra: { kept: true } };
  const result = evaluateShadowRecords([legacy, ...many(2)]);
  assert.equal(gate(result, "parse").pass, true);
  assert.equal(result.summary.unknown, 1);
  assert.equal(result.summary.available, 2);
});

test("fallback telemetry exits 1 and names the shortfall", () =>
  withTempDir((dir) => {
    const file = path.join(dir, "context-shadow.jsonl");
    const lines = many(20, {
      projectionAvailable: false,
      fallbackReason: "no-ledger-and-no-base",
    });
    fs.writeFileSync(file, `${lines.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
    const result = runCli(["--file", file]);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /availability: 0 available, 20 fallback, 0 unknown/);
    assert.match(result.stdout, /0 available record\(s\), minimum 20/);
  }));
