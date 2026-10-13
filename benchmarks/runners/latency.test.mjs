import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runBaselineTurn } from "./baseline-runner.mjs";
import { runWamTurn } from "./wam-runner.mjs";
import { createCollector } from "../instrumentation/collector.mjs";
import { createMockProvider } from "../providers/provider.mjs";
import { buildStatistics } from "../run-real.mjs";

const DELAY_MS = 20;

function makeDelayedProvider(delayMs = DELAY_MS) {
  return {
    model: "mock/delayed",
    isConfigured: () => true,
    estimateTokens: (text = "") => Math.ceil(String(text).length / 4),
    complete: async ({ messages = [] }) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = `[delayed-response] ${promptText.length} chars`;
      const inputTokens = Math.ceil(promptText.length / 4);
      const outputTokens = Math.ceil(text.length / 4);
      return {
        text,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        model: "mock/delayed",
        provider: "mock"
      };
    }
  };
}

const scenario = { id: "LAT-T1" };
const turn = { prompt: "measure latency", input: {} };

test("latency: runners measure wall-clock around provider.complete", async (t) => {
  const provider = makeDelayedProvider();
  const collector = createCollector();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-lat-"));

  await t.test("runBaselineTurn returns latencyMs >= 10", async () => {
    const baseline = await runBaselineTurn({
      scenario,
      turn,
      turnIndex: 0,
      provider,
      repoCommit: "test"
    });
    assert.strictEqual(typeof baseline.latencyMs, "number");
    assert.ok(Number.isInteger(baseline.latencyMs));
    assert.ok(baseline.latencyMs >= 10, `expected >= 10, got ${baseline.latencyMs}`);
  });

  await t.test("runWamTurn returns latencyMs >= 10", async () => {
    const wam = await runWamTurn({
      scenario,
      turn,
      turnIndex: 0,
      provider,
      collector,
      repoCommit: "test",
      root
    });
    assert.strictEqual(typeof wam.latencyMs, "number");
    assert.ok(Number.isInteger(wam.latencyMs));
    assert.ok(wam.latencyMs >= 10, `expected >= 10, got ${wam.latencyMs}`);
  });

  await t.test("createMockProvider path yields numeric latencyMs >= 0", async () => {
    const baseline = await runBaselineTurn({
      scenario,
      turn,
      turnIndex: 0,
      provider: createMockProvider(),
      repoCommit: "test"
    });
    assert.strictEqual(typeof baseline.latencyMs, "number");
    assert.ok(baseline.latencyMs >= 0);
  });
});

test("latency: buildStatistics exposes per-arm latency summaries", async () => {
  const provider = makeDelayedProvider();
  const collector = createCollector();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wam-lat-stats-"));

  const baseline = await runBaselineTurn({ scenario, turn, turnIndex: 0, provider, repoCommit: "test" });
  const wam = await runWamTurn({
    scenario,
    turn,
    turnIndex: 0,
    provider,
    collector,
    repoCommit: "test",
    root
  });

  const suite = {
    results: [
      {
        scenarioId: scenario.id,
        trialId: 0,
        pairId: `${scenario.id}#0`,
        turns: [{ turnIndex: 0, baseline, wam }]
      }
    ],
    metrics: {}
  };

  const stats = buildStatistics(suite, "mock/delayed", "mock");
  assert.ok(stats.baselineLatencyMs, "missing baselineLatencyMs");
  assert.ok(stats.wamLatencyMs, "missing wamLatencyMs");
  assert.strictEqual(stats.baselineLatencyMs.n, 1);
  assert.strictEqual(stats.wamLatencyMs.n, 1);
  assert.ok(stats.baselineLatencyMs.mean >= 10, `baseline mean ${stats.baselineLatencyMs.mean}`);
  assert.ok(stats.wamLatencyMs.mean >= 10, `wam mean ${stats.wamLatencyMs.mean}`);
  assert.strictEqual(stats.latencyMs.n, 2);
});
