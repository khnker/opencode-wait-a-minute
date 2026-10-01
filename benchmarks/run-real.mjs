import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { runRealScenario } from "./runners/real-session.mjs";
import { evaluateTask } from "./evaluation/success.mjs";
import { computeMetrics } from "./evaluation/metrics.mjs";
import { buildRealReport } from "./evaluation/compare-runs.mjs";
import { RC1_SCENARIOS } from "./scenarios/rc1.mjs";
import { createMockProvider } from "./providers/provider.mjs";
import { resolveProvider } from "./providers/index.mjs";
import { DETERMINISTIC_EVIDENCE } from "./reporters/claims.mjs";

export async function runRealSuite({ provider, scenarios, root, timestamp, trials = 1 }) {
  const allScenarios = scenarios || (await import("./scenarios/real.mjs")).REAL_SCENARIOS;
  const trialCount = Number.isFinite(trials) && trials >= 1 ? Math.floor(trials) : 1;
  const results = [];
  const evaluations = [];

  for (const scenario of allScenarios) {
    for (let trialId = 0; trialId < trialCount; trialId++) {
      const res = await runRealScenario({ scenario, provider, root, trialId });
      results.push(res);
      for (const turn of res.turns) {
        const evaluation = evaluateTask({ baseline: turn.baseline, wam: turn.wam });
        evaluations.push({ scenarioId: scenario.id, trialId, ...evaluation });
      }
    }
  }

  return {
    benchmark: "real-llm",
    version: "1.0.0",
    mode: "real-llm",
    timestamp: timestamp || new Date().toISOString(),
    results,
    evaluations,
    metrics: computeMetrics({ results, evaluations })
  };
}

/**
 * Dry-run entry point: uses the in-file mock provider and RC1 scenarios
 * to exercise the full harness without network access. Writes
 * `real-report.json` into `outDir`.
 */
export async function runDryRun({ outDir } = {}) {
  const provider = createMockProvider();
  const scenarios = RC1_SCENARIOS;
  const suite = await runRealSuite({ provider, scenarios });

  const report = buildRealReport({
    sessionResults: suite.results,
    model: provider.model,
    provider: "mock",
    evidence: DETERMINISTIC_EVIDENCE
  });
  report.evaluations = suite.evaluations;
  report.metrics = suite.metrics;

  const dir = outDir || path.join("benchmarks", "results", `dry-run-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(suite, null, 2));
  fs.writeFileSync(path.join(dir, "real-report.json"), JSON.stringify(report, null, 2));
  return { dir, report, suite };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const dryRunFlag = argv.includes("--dry-run") || process.env.WAM_BENCH_DRY_RUN === "1";
  const outIdx = argv.indexOf("--out");
  const outDir = outIdx >= 0 ? argv[outIdx + 1] : undefined;

  if (dryRunFlag) {
    const { dir, report } = await runDryRun({ outDir });
    console.log(`[run-real] dry-run complete → ${dir}`);
    console.log("netInputSavings:", report.netInputSavings, "breakEvenTurn:", report.breakEvenTurn);
    process.exit(0);
  }

  if (!process.env.WAM_BENCH_BASE_URL) {
    console.log("[run-real] skipped: set WAM_BENCH_BASE_URL/WAM_BENCH_API_KEY/WAM_BENCH_MODEL to run");
    process.exit(0);
  }

  const provider = resolveProvider();

  const suite = await runRealSuite({ provider });
  const iso = new Date().toISOString().replace(/:/g, "-");
  const dir = outDir
    ? path.resolve(outDir)
    : path.join("benchmarks", "results", iso);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(suite, null, 2));

  const report = buildRealReport({
    sessionResults: suite.results,
    model: provider.model,
    provider: "openai-compatible"
  });
  report.evaluations = suite.evaluations;
  report.metrics = suite.metrics;
  fs.writeFileSync(path.join(dir, "real-report.json"), JSON.stringify(report, null, 2));

  console.log("Metrics:", suite.metrics);
}
