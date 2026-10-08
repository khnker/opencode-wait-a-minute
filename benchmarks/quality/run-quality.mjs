#!/usr/bin/env node
/**
 * QUALITY A/B runner (WAM arm vs Baseline arm).
 *
 * Reuses the existing paired runner so prompt construction is identical to
 * the token-savings experiment. For each scenario turn we compute:
 *
 *   - factCoverage(baseline.response, rubric.requiredFacts)
 *   - factCoverage(wam.response,      rubric.requiredFacts)
 *   - empty-response count per arm
 *   - (optional, --judge) judgeResponse per arm
 *
 * Emits a JSON report under benchmarks/results/quality-<timestamp>.json and a
 * compact summary on stdout. Exit code 0 on success, 1 if any scenario lacks
 * a rubric.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProvider } from "../providers/index.mjs";
import { runPairedScenario } from "../real/runners/paired-runner.mjs";
import { buildBaselineRequest, buildWamRequest } from "../real/runners/paired-runner.mjs";
import { factCoverage, aggregate, pairedQualityDelta } from "./scoring.mjs";
import { judgeResponse } from "./judge.mjs";
import { QUALITY_SCENARIOS } from "./scenarios.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.resolve(__dirname, "..", "results");

function parseArgs(argv) {
  const out = { offline: false, judge: false, judgeModel: null, scenarios: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--offline") out.offline = true;
    else if (a === "--judge") out.judge = true;
    else if (a === "--judge-model") {
      out.judgeModel = argv[++i] ?? null;
    } else if (a === "--scenario") {
      const id = argv[++i];
      out.scenarios = out.scenarios ?? [];
      if (id) out.scenarios.push(id);
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(
    "Usage: node benchmarks/quality/run-quality.mjs [options]\n" +
      "  --offline                  force mock provider (no network).\n" +
      "  --judge                    enable LLM judge scoring (offline by default).\n" +
      "  --judge-model <name>       override judge model (env WAM_BENCH_JUDGE_MODEL).\n" +
      "  --scenario <id>            run only the named scenario (repeatable).\n" +
      "  --help, -h                 this help."
  );
}

function ensureRubrics(scenarios) {
  const missing = scenarios.filter((s) => !s.rubric);
  if (missing.length === 0) return true;
  // eslint-disable-next-line no-console
  console.error(
    `Missing rubric on ${missing.length} scenario(s): ${missing
      .map((m) => m.id)
      .join(", ")}`
  );
  return false;
}

function pickScenarios(all, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return all;
  const wanted = new Set(ids);
  return all.filter((s) => wanted.has(s.id));
}

/**
 * Execute a per-arm call (baseline or WAM) with a single empty-text retry.
 *
 * Some upstream providers occasionally return an empty string for a single
 * turn (transient stream error, rate-limit reset, etc.) that resolves on a
 * retry. To keep scoring robust without masking sustained failures, we retry
 * a blank response ONCE and surface a `retries` count on the turn.
 *
 * Determinism: the offline/mock provider always returns non-empty text so
 * this branch never fires in tests.
 */
async function armCallWithRetry(armFn, retriesRef, armName) {
  let resp = await armFn();
  if (resp && typeof resp.text === "string" && resp.text.trim().length > 0) {
    return { resp, retried: false };
  }
  retriesRef[armName] = (retriesRef[armName] ?? 0) + 1;
  resp = await armFn();
  return { resp, retried: true };
}

async function runOne({ scenario, provider, judgeEnabled, judgeProvider }) {
  const paired = await runPairedScenario({ scenario, provider });
  // Flakiness guard: for any arm whose response came back empty/whitespace,
  // retry that arm ONCE. Retries are recorded per turn (and aggregated below)
  // so we can spot unreliable providers without masking sustained failures.
  // Deterministic mocks return non-empty text, so tests never trigger this.
  const retries = { baseline: 0, wam: 0 };
  for (const t of paired.turns ?? []) {
    const turn = scenario.turns?.[t.turnIndex];
    if (!turn) continue;
    if (!t.baseline || typeof t.baseline.text !== "string" || t.baseline.text.trim() === "") {
      // retry baseline
      // eslint-disable-next-line no-await-in-loop
      const retried = await provider.complete(buildBaselineRequest(turn));
      t.baseline = retried;
      retries.baseline += 1;
    }
    if (!t.wam || typeof t.wam.text !== "string" || t.wam.text.trim() === "") {
      // retry WAM
      // eslint-disable-next-line no-await-in-loop
      const retried = await provider.complete(buildWamRequest(scenario, turn));
      t.wam = retried;
      retries.wam += 1;
    }
  }
  const perTurn = (paired.turns ?? []).map((t) => {
    const baseCov = factCoverage(t.baseline?.text ?? "", scenario.rubric.requiredFacts);
    const wamCov = factCoverage(t.wam?.text ?? "", scenario.rubric.requiredFacts);
    return {
      turnIndex: t.turnIndex,
      baselineText: t.baseline?.text ?? "",
      wamText: t.wam?.text ?? "",
      baselineFactScore: baseCov.score,
      wamFactScore: wamCov.score,
      baselineMatched: baseCov.matched,
      wamMatched: wamCov.matched,
      baselineMissing: baseCov.missing,
      wamMissing: wamCov.missing
    };
  });

  const factPair = pairedQualityDelta(
    perTurn.map((t) => t.baselineFactScore),
    perTurn.map((t) => t.wamFactScore)
  );

  let judge = null;
  if (judgeEnabled && judgeProvider) {
    const task = scenario.turns?.[0]?.prompt ?? scenario.description;
    const baseJudgeRaw = perTurn.map((t) =>
      judgeResponse({ provider: judgeProvider, task, response: t.baselineText, rubric: scenario.rubric })
    );
    const wamJudgeRaw = perTurn.map((t) =>
      judgeResponse({ provider: judgeProvider, task, response: t.wamText, rubric: scenario.rubric })
    );
    const baseJudge = await Promise.all(baseJudgeRaw);
    const wamJudge = await Promise.all(wamJudgeRaw);
    const baseScores = baseJudge.map((j) => (typeof j.score === "number" ? j.score : null));
    const wamScores = wamJudge.map((j) => (typeof j.score === "number" ? j.score : null));
    const aligned = baseScores
      .map((b, i) => [b, wamScores[i]])
      .filter((pair) => typeof pair[0] === "number" && typeof pair[1] === "number");
    const deltas = aligned.map(([a, b]) => b - a);
    judge = {
      baselineAggregate: aggregate(baseScores),
      wamAggregate: aggregate(wamScores),
      deltaAggregate: aggregate(deltas),
      wins: deltas.filter((d) => d > 0).length,
      losses: deltas.filter((d) => d < 0).length,
      ties: deltas.filter((d) => d === 0).length,
      perTurn: baseJudge.map((j, i) => ({
        baseline: { score: j.score, pass: j.pass, reason: j.reason },
        wam: { score: wamJudge[i].score, pass: wamJudge[i].pass, reason: wamJudge[i].reason }
      }))
    };
  }

  const emptyBaseline = perTurn.filter((t) => !t.baselineText.trim()).length;
  const emptyWam = perTurn.filter((t) => !t.wamText.trim()).length;

  return {
    id: scenario.id,
    description: scenario.description,
    category: scenario.category ?? "quality",
    budget: scenario.budget,
    rubric: scenario.rubric,
    turns: perTurn,
    factPair,
    judge,
    emptyBaseline,
    emptyWam,
    retries,
    pairedMetrics: paired.metrics,
    outcomeMatch: paired.outcomeMatch,
    comparison: paired.comparison
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }
  if (!ensureRubrics(QUALITY_SCENARIOS)) return 1;

  const provider = args.offline
    ? // eslint-disable-next-line global-require
      (await import("../providers/provider.mjs")).createMockProvider()
    : resolveProvider({ env: process.env });

  const judgeProvider = args.judge && !args.offline ? resolveProvider({ env: process.env }) : null;
  const judgeEnabled = !!args.judge && !!judgeProvider;

  const scenarios = pickScenarios(QUALITY_SCENARIOS, args.scenarios);
  if (scenarios.length === 0) {
    // eslint-disable-next-line no-console
    console.error("No scenarios selected.");
    return 1;
  }

  const perScenario = [];
  for (const scenario of scenarios) {
    const out = await runOne({
      scenario,
      provider,
      judgeEnabled,
      judgeProvider
    });
    perScenario.push(out);
  }

  // Aggregate across scenarios
  const baseFactScores = perScenario.flatMap((s) => s.turns.map((t) => t.baselineFactScore));
  const wamFactScores = perScenario.flatMap((s) => s.turns.map((t) => t.wamFactScore));
  const factDelta = pairedQualityDelta(baseFactScores, wamFactScores);

  const summary = {
    baselineFactScore: aggregate(baseFactScores).mean,
    wamFactScore: aggregate(wamFactScores).mean,
    factDelta,
    wins: factDelta.wins,
    losses: factDelta.losses,
    ties: factDelta.ties,
    emptyBaseline: perScenario.reduce((a, s) => a + s.emptyBaseline, 0),
    emptyWam: perScenario.reduce((a, s) => a + s.emptyWam, 0),
    retries: {
      baseline: perScenario.reduce((a, s) => a + (s.retries?.baseline ?? 0), 0),
      wam: perScenario.reduce((a, s) => a + (s.retries?.wam ?? 0), 0)
    }
  };

  if (judgeEnabled) {
    const baselineJudge = perScenario
      .map((s) => s.judge?.baselineAggregate?.mean ?? 0)
      .filter((v) => typeof v === "number");
    const wamJudge = perScenario
      .map((s) => s.judge?.wamAggregate?.mean ?? 0)
      .filter((v) => typeof v === "number");
    summary.baselineJudge = aggregate(baselineJudge).mean;
    summary.wamJudge = aggregate(wamJudge).mean;
    summary.judgeDelta = summary.wamJudge - summary.baselineJudge;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    provider: provider?.provider ?? provider?.model ?? "mock",
    model: provider?.model ?? "mock",
    offline: args.offline || !provider?.isConfigured?.(),
    judgeEnabled,
    judgeModel: args.judgeModel ?? process.env.WAM_BENCH_JUDGE_MODEL ?? null,
    perScenario,
    summary
  };

  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RESULTS_DIR, `quality-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  // eslint-disable-next-line no-console
  console.log(
    `QUALITY REPORT ${outPath}\n` +
      `provider=${report.provider} model=${report.model} offline=${report.offline} judge=${report.judgeEnabled}\n` +
      `scenarios=${perScenario.length} turns=${perScenario.reduce((a, s) => a + s.turns.length, 0)}\n` +
      `fact: baseline=${summary.baselineFactScore.toFixed(3)} wam=${summary.wamFactScore.toFixed(3)} delta=${summary.factDelta.meanDelta.toFixed(3)} wins=${summary.wins} losses=${summary.losses} ties=${summary.ties}\n` +
      (summary.judgeDelta != null
        ? `judge: baseline=${summary.baselineJudge.toFixed(1)} wam=${summary.wamJudge.toFixed(1)} delta=${summary.judgeDelta.toFixed(1)}\n`
        : "") +
      `empty: baseline=${summary.emptyBaseline} wam=${summary.emptyWam}`
  );

  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // eslint-disable-next-line no-console
    console.error("run-quality failed:", err && err.stack ? err.stack : err);
    process.exit(2);
  }
);
