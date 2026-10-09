import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { runRealScenario } from "./runners/real-session.mjs";
import { evaluateTask } from "./evaluation/success.mjs";
import { computeMetrics } from "./evaluation/metrics.mjs";
import { buildRealReport, normalizeRuns } from "./evaluation/compare-runs.mjs";
import { RC1_SCENARIOS } from "./scenarios/rc1.mjs";
import { createMockProvider } from "./providers/provider.mjs";
import { resolveProvider } from "./providers/index.mjs";
import { DETERMINISTIC_EVIDENCE } from "./reporters/claims.mjs";
import { buildEvidenceManifest } from "./reporters/manifest.mjs";
import { listAblations, summarizeAblation } from "./evaluation/ablation.mjs";
import { pairedDelta, summarize } from "./evaluation/statistics.mjs";
import { getRepoCommit } from "./runners/baseline-runner.mjs";
import { aggregateTrials } from "./real/runners/paired-runner.mjs";

export async function runRealSuite({ provider, scenarios, root, timestamp, trials = 1, ablated = false }) {
  const allScenarios = scenarios || (await import("./scenarios/real.mjs")).REAL_SCENARIOS;
  const trialCount = Number.isFinite(trials) && trials >= 1 ? Math.floor(trials) : 1;
  const ablations = ablated ? listAblations() : [{ name: "full", config: {} }];
  const results = [];
  const evaluations = [];

  for (const scenario of allScenarios) {
    for (let trialId = 0; trialId < trialCount; trialId++) {
      for (const { name, config } of ablations) {
        const res = await runRealScenario({ scenario, provider, root, trialId, ablation: config, ablationName: name });
        results.push(res);
        for (const turn of res.turns) {
          const evaluation = evaluateTask({ baseline: turn.baseline, wam: turn.wam });
          evaluations.push({ scenarioId: scenario.id, trialId, ablation: name, ...evaluation });
        }
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
 * Build the per-metric paired statistics block: pairs the baseline input
 * token sum with the WAM input token sum per `pairId` (default behavior when
 * not ablated yields one pair per scenario × trial; ablated yields one per
 * scenario × trial × ablation). Returns paired deltas plus a `summarize`
 * of aggregate metrics.
 */
function buildStatistics(suite, model, provider) {
  const runs = suite.results.flatMap((sessionResult) =>
    normalizeRuns(sessionResult, { model, provider })
  );
  const pairMap = new Map();
  for (const r of runs) {
    const key = r.pairId || `${r.scenario}#${r.trialId ?? 0}`;
    const p = pairMap.get(key) ?? { pairId: key, scenario: r.scenario, baseline: 0, wam: 0 };
    p.baseline += r.baselineInputTokens;
    p.wam += r.inputTokens + r.wamOverheadTokens;
    pairMap.set(key, p);
  }
  const pairs = Array.from(pairMap.values());
  const baselineArr = pairs.map((p) => p.baseline);
  const wamArr = pairs.map((p) => p.wam);

  const metrics = suite.metrics ?? {};
  const metricSummary = {};
  for (const [k, v] of Object.entries(metrics)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      metricSummary[k] = summarize([v]);
    } else if (v && typeof v === "object") {
      // Nested metrics (e.g. { mean, stddev, n }) → summarize as scalar mean
      const scalar = Number(v.mean);
      if (Number.isFinite(scalar)) metricSummary[k] = summarize([scalar]);
    }
  }

  return {
    baselineInputTokens: summarize(baselineArr),
    wamInputTokens: summarize(wamArr),
    paired: pairedDelta(baselineArr, wamArr),
    metrics: metricSummary
  };
}

/**
 * Dry-run entry point: uses the in-file mock provider and RC1 scenarios
 * to exercise the full harness without network access. Writes
 * `real-report.json` into `outDir`.
 */
/**
 * Derive per-trial scalar metrics from a suite's scenario results so they can
 * be summarized into the `trialStats` block. One entry per scenario × trial.
 */
function perTrialMetricsFromResults(results) {
  const list = Array.isArray(results) ? results : [];
  return list.map((r) => {
    const turns = Array.isArray(r.turns) ? r.turns : [];
    const baselineInput = turns.reduce(
      (n, t) => n + (t.baseline?.usage?.inputTokens ?? 0),
      0
    );
    const wamInput = turns.reduce(
      (n, t) => n + (t.wam?.usage?.inputTokens ?? 0),
      0
    );
    const contextRebuilds = turns.reduce(
      (n, t) => n + (t.wam?.counters?.Context_reconstructed ?? 0),
      0
    );
    const netSavingsPct =
      baselineInput > 0 ? ((baselineInput - wamInput) / baselineInput) * 100 : 0;
    const stateEquivalentRate =
      r.stateEquivalent === true
        ? 1
        : typeof r.stateEquivalent === "number"
          ? r.stateEquivalent
          : 0;
    return { baselineInput, wamInput, netSavingsPct, contextRebuilds, stateEquivalentRate };
  });
}

export async function runDryRun({ outDir, ablated = false, trials = 1 } = {}) {
  const provider = createMockProvider();
  const scenarios = RC1_SCENARIOS;
  const suite = await runRealSuite({ provider, scenarios, ablated, trials });

  const report = buildRealReport({
    sessionResults: suite.results,
    model: provider.model,
    provider: "mock",
    evidence: DETERMINISTIC_EVIDENCE
  });
  report.evaluations = suite.evaluations;
  report.metrics = suite.metrics;
  report.statistics = buildStatistics(suite, provider.model, "mock");
  report.trialStats = aggregateTrials(perTrialMetricsFromResults(suite.results));

  if (ablated) {
    const allRuns = suite.results.flatMap(sr => normalizeRuns(sr, { model: provider.model, provider: "mock" }));
    report.ablation = listAblations().map(a => summarizeAblation(a.name, allRuns.filter(r => r.ablation === a.name)));
  }

  const dir = outDir || path.join("benchmarks", "results", `dry-run-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(suite, null, 2));
  const reportPath = path.join(dir, "real-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const manifest = buildEvidenceManifest({
    report,
    suite,
    reportPath,
    repoCommit: getRepoCommit(),
    generatedAt: report.timestamp
  });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { dir, report, suite, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const dryRunFlag = argv.includes("--dry-run") || process.env.WAM_BENCH_DRY_RUN === "1";
  const ablationFlag = argv.includes("--ablation");
  const outIdx = argv.indexOf("--out");
  const outDir = outIdx >= 0 ? argv[outIdx + 1] : undefined;
  const trialsIdx = argv.indexOf("--trials");
  const trials =
    trialsIdx >= 0
      ? Number(argv[trialsIdx + 1])
      : Number(process.env.WAM_BENCH_TRIALS) || 1;

  if (dryRunFlag) {
    const { dir, report, manifest } =
      await runDryRun({ outDir, ablated: ablationFlag, trials });
    console.log(`[run-real] dry-run complete → ${dir}`);
    console.log("netInputSavings:", report.netInputSavings, "breakEvenTurn:", report.breakEvenTurn);
    console.log("trialStats.n:", report.trialStats?.n);
    console.log("manifest:", manifest.schema, "runs:", manifest.counts.runs, "trials:", manifest.counts.trials);
    if (ablationFlag) {
      console.log("ablation:", report.ablation.map((a) => a.name).join(","));
    }
    process.exit(0);
  }

  if (!process.env.WAM_BENCH_BASE_URL) {
    console.error("[run-real] ERROR: WAM_BENCH_BASE_URL not set");
    process.exit(2);
  }

  const provider = resolveProvider();

  let suite;
  try {
    suite = await runRealSuite({ provider, trials });
  } catch (error) {
    console.error(`[run-real] ERROR: benchmark run failed: ${error?.message ?? error}`);
    process.exit(1);
  }
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
  report.statistics = buildStatistics(suite, provider.model, "openai-compatible");
  const reportPath = path.join(dir, "real-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  const manifest = buildEvidenceManifest({
    report,
    suite,
    reportPath,
    repoCommit: getRepoCommit(),
    generatedAt: report.timestamp
  });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("Metrics:", suite.metrics);
}
