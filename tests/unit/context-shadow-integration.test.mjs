import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import pluginDefault from "../../index.js";
import { emptyExecutionLedger, saveExecutionLedger } from "../../src/state/execution-ledger.js";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-shadow-int-"));
}

function writeConfig(root, config) {
  fs.mkdirSync(path.join(root, ".wam"), { recursive: true });
  fs.writeFileSync(path.join(root, ".wam", "config.json"), JSON.stringify({ logging: false, ...config }));
}

async function start(root) {
  return pluginDefault({ directory: root, client: {}, project: {}, $: {} });
}

async function compactIn(root, sessionID, config, taskId) {
  writeConfig(root, config);
  const hooks = await start(root);
  await hooks["chat.message"](
    {
      sessionID,
      messageID: "m1",
      message: { parts: [{ type: "text", text: "implementa un endpoint OAuth2 con tests" }] },
      taskId,
    },
    { message: {}, parts: [] },
  );
  const output = { context: [] };
  await hooks["experimental.session.compacting"]({ sessionID }, output);
  return output.context.join("\n");
}

async function withMetricsDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-shadow-metrics-"));
  const previous = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (previous === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readRecords(file) {
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("shadow injects legacy text byte-identically and appends a comparison record", async () => {
  const legacyRoot = makeRoot();
  const shadowRoot = makeRoot();
  const sessionID = "shadow-int";
  try {
    await withMetricsDir(async (metrics) => {
      const legacyText = await compactIn(legacyRoot, sessionID, { contextProjection: "legacy" }, "shadow-task");
      assert.match(legacyText, /\[wam context brief\]/);

      const shadowText = await compactIn(shadowRoot, sessionID, { contextProjection: "shadow" }, "shadow-task");

      assert.equal(shadowText, legacyText, "shadow output must stay byte-identical to legacy");

      const file = path.join(metrics, "context-shadow.jsonl");
      assert.ok(fs.existsSync(file), "shadow record appended");
      const records = readRecords(file);
      assert.equal(records.length, 1);
      const record = records[0];
      assert.equal(record.schemaVersion, 1);
      assert.equal(record.mode, "shadow");
      assert.equal(record.sessionId, sessionID);
      assert.equal(record.taskId, "shadow-task");
      assert.equal(record.injectedChars, legacyText.length);
      assert.equal(typeof record.budgetChars, "number");
      assert.match(record.injectedHash, /^[a-f0-9]{64}$/);
      assert.match(record.shadowHash, /^[a-f0-9]{64}$/);
      assert.equal(record.equivalent, record.injectedHash === record.shadowHash);
      assert.ok(record.requirements && Array.isArray(record.requirements.included));
      assert.ok(record.decisions && typeof record.decisions.live === "number");
      assert.equal(typeof record.constraints, "number");
      assert.equal(typeof record.retrievableRefs, "number");
    });
  } finally {
    fs.rmSync(legacyRoot, { recursive: true, force: true });
    fs.rmSync(shadowRoot, { recursive: true, force: true });
  }
});

test("unset config keeps active behavior and writes no shadow file", async () => {
  const defaultRoot = makeRoot();
  const activeRoot = makeRoot();
  const sessionID = "active-int";
  try {
    await withMetricsDir(async (metrics) => {
      const defaultText = await compactIn(defaultRoot, sessionID, {}, "active-task");
      assert.match(defaultText, /\[wam context brief\]/);

      const activeText = await compactIn(activeRoot, sessionID, { contextProjection: "active" }, "active-task");

      assert.equal(activeText, defaultText, "unset must behave as active");
      assert.equal(fs.existsSync(path.join(metrics, "context-shadow.jsonl")), false);
    });
  } finally {
    fs.rmSync(defaultRoot, { recursive: true, force: true });
    fs.rmSync(activeRoot, { recursive: true, force: true });
  }
});

test("shadow telemetry failure is fail-soft and compaction still injects context", async () => {
  const root = makeRoot();
  const blockerDir = makeRoot();
  const blocker = path.join(blockerDir, "not-a-directory");
  fs.writeFileSync(blocker, "x");
  const previous = process.env.WAM_METRICS_DIR;
  process.env.WAM_METRICS_DIR = path.join(blocker, "nested");
  try {
    const text = await compactIn(root, "fail-soft-int", { contextProjection: "shadow" }, "fail-soft-task");
    assert.match(text, /\[wam context brief\]/);
  } finally {
    if (previous === undefined) delete process.env.WAM_METRICS_DIR;
    else process.env.WAM_METRICS_DIR = previous;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(blockerDir, { recursive: true, force: true });
  }
});

test("shadow without a ledger or base reports projectionAvailable false", async () => {
  const root = makeRoot();
  try {
    await withMetricsDir(async (metrics) => {
      await compactIn(root, "fallback-int", { contextProjection: "shadow" }, "fallback-task");
      const records = readRecords(path.join(metrics, "context-shadow.jsonl"));
      assert.equal(records.at(-1).projectionAvailable, false);
      assert.equal(records.at(-1).fallbackReason, "no-ledger-and-no-base");
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("shadow with a seeded ledger reports projectionAvailable true", async () => {
  const root = makeRoot();
  const taskId = "ledger-task";
  try {
    const ledger = emptyExecutionLedger(taskId);
    ledger.requirements["req-1"] = {
      id: "req-1",
      claim: "seeded requirement",
      status: "in_progress",
      evidence: [],
      actions: [],
      observations: [],
    };
    saveExecutionLedger(root, ledger);
    await withMetricsDir(async (metrics) => {
      await compactIn(root, "ledger-int", { contextProjection: "shadow" }, taskId);
      const records = readRecords(path.join(metrics, "context-shadow.jsonl"));
      assert.equal(records.at(-1).projectionAvailable, true);
      assert.equal(records.at(-1).fallbackReason, null);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
