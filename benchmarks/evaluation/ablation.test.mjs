/**
 * Block 07 — empirical ablation harness.
 *
 * Verifies that:
 *   - `runRealSuite({ablated:true})` runs each scenario once per ablation
 *     configuration, producing results for every entry in `listAblations()`.
 *   - The `full` configuration yields at least one fast-path hit on the
 *     continuation-3 scenario (turns 2 and 3 are fast-path eligible).
 *   - The `no_snapshot` configuration never produces fast-path hits.
 *   - All configurations produce finite `netInputSavings` values.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildContinuationScenarios } from "../scenarios/continuation.mjs";
import { runRealSuite } from "../run-real.mjs";
import { listAblations, summarizeAblation } from "./ablation.mjs";
import { normalizeRuns } from "./compare-runs.mjs";

function makeMockProvider() {
  return {
    model: "test/ablation-mock",
    isConfigured: () => true,
    estimateTokens: (text = "") => Math.ceil(String(text).length / 4),
    complete: async ({ messages }) => {
      const promptText = messages.map((m) => m.content ?? "").join("");
      const text = "ok";
      const inputTokens = Math.ceil(promptText.length / 4);
      return { text, usage: { inputTokens, outputTokens: 1 } };
    }
  };
}

test("runRealSuite({ablated:true}) covers all listAblations() configs", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1, ablated: true });

  const expectedNames = listAblations().map((a) => a.name);
  // Per scenario × trial × ablation-config
  assert.equal(suite.results.length, scenarios.length * 1 * expectedNames.length,
    `expected ${scenarios.length * expectedNames.length} results, got ${suite.results.length}`);

  // Verify that results are tagged with their ablation name via the 'ablation' field
  const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "test" }));
  const seenNames = new Set(allRuns.map(r => r.ablation).filter(Boolean));
  for (const name of expectedNames) {
    assert.ok(seenNames.has(name), `expected ablation "${name}" in results`);
    const filtered = allRuns.filter(r => r.ablation === name);
    assert.equal(filtered.length, allRuns.length / expectedNames.length, `ablation ${name} should have ${allRuns.length / expectedNames.length} runs`);
  }
});

test("full ablation produces fast-path hits on continuation-3", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1, ablated: true });

  const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "test" }));
  const runs = allRuns.filter(r => r.ablation === "full");
  const summary = summarizeAblation("full", runs);
  assert.ok(summary.fastPathCount > 0, `full.fastPathCount should be >0, got ${summary.fastPathCount}`);
});

test("no_snapshot ablation never produces fast-path hits", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1, ablated: true });

  const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "test" }));
  const runs = allRuns.filter(r => r.ablation === "no_snapshot");
  const summary = summarizeAblation("no_snapshot", runs);
  assert.equal(summary.fastPathCount, 0, `no_snapshot.fastPathCount should be 0, got ${summary.fastPathCount}`);
});

test("all subset configurations produce finite netInputSavings", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1, ablated: true });

  const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "test" }));
  for (let i = 0; i < listAblations().length; i++) {
    const cfg = listAblations()[i];
    if (cfg.name === "full") continue; // skip baseline
    const runs = allRuns.filter(r => r.ablation === cfg.name);
    const summary = summarizeAblation(cfg.name, runs);
    assert.ok(Number.isFinite(summary.netInputSavings),
      `${cfg.name}.netInputSavings should be finite, got ${summary.netInputSavings}`);
  }
});

test("ablated suite stamps ablation metadata on each scenario result", async () => {
  const provider = makeMockProvider();
  const scenarios = buildContinuationScenarios([3]);
  const suite = await runRealSuite({ provider, scenarios, trials: 1, ablated: true });

  // In full, wam.verified defaults true; in no_verification, wam.verified is false.
  const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "test" }));
  const noVer = suite.results.filter(sr => {
    const runs = normalizeRuns(sr, { model: provider.model, provider: "test" });
    return runs.some(r => r.ablation === "no_verification");
  });
  for (const res of noVer) {
    for (const turn of res.turns) {
      assert.equal(turn.wam.verified, false, `turn ${turn.turnIndex} should have wam.verified=false`);
    }
  }
});

test("runDryRun({ablated:true}) report.ablation is tagged correctly", async () => {
  const { runDryRun } = await import("../run-real.mjs");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-dry-ablation-"));
  const { report } = await runDryRun({ outDir: tmp, ablated: true });

  const expectedNames = ["full", "no_snapshot", "no_rebuild", "unlimited_budget", "no_verification"];
  assert.ok(Array.isArray(report.ablation), "report.ablation must be an array");
  assert.equal(report.ablation.length, expectedNames.length, "report.ablation must have all 5 entries");

  const byName = new Map(report.ablation.map(a => [a.name, a]));
  for (const name of expectedNames) {
    const entry = byName.get(name);
    assert.ok(entry, `ablation entry "${name}" must exist`);
    assert.equal(entry.runs, 30, `${name}.runs should be 30, got ${entry.runs}`);
  }

  const full = byName.get("full");
  assert.ok(full.fastPathCount > 0, `full.fastPathCount should be >0, got ${full.fastPathCount}`);

  const noSnap = byName.get("no_snapshot");
  assert.equal(noSnap.fastPathCount, 0, `no_snapshot.fastPathCount should be 0, got ${noSnap.fastPathCount}`);
});
