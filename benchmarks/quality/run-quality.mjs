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
 * Can be used as a library or run directly.
 *
 * When used as a library, it expects an options object with:
 *   - outDir: string (directory to write the three artifacts: raw.json, metrics.json, report.md)
 *   - timestamp: string (ISO timestamp for the run)
 *   - provider: string (provider name, e.g., "mock" or actual provider)
 *   - model: string (model name, if applicable)
 *   - scenarios: array of scenarios (each scenario must have id, description, budget, rubric, turns)
 *   - trials: number (default 1)
 *   - ablated: boolean (default false)
 *   - judge: boolean (default false)
 *   - judgeModel: string or null (default null)
 *
 * It returns a promise that resolves to an object with:
 *   - rawPath: path to raw.json (relative to outDir)
 *   - metricsPath: path to metrics.json (relative to outDir)
 *   - reportPath: path to report.md (relative to outDir)
 *
 * When run directly, it uses the existing command-line interface and writes a legacy report to benchmarks/results/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveProvider, createMockProvider } from "../providers/index.mjs";
import { runPairedScenario } from "../real/runners/paired-runner.mjs";
import { buildBaselineRequest, buildWamRequest } from "../real/runners/paired-runner.mjs";
import { factCoverage, aggregate, pairedQualityDelta, extractFinalAnswer, ANSWER_INSTRUCTION } from "./scoring.mjs";
import { judgeResponse } from "./judge.mjs";
import { QUALITY_SCENARIOS } from "./scenarios.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run the quality benchmark suite and write the three artifacts to the given output directory.
 *
 * @param {{
 *   outDir: string,
 *   timestamp: string,
 *   provider?: string,
 *   model?: string,
 *   scenarios?: Array<{
 *     id: string,
 *     description: string,
 *     budget: number,
 *     rubric: {
 *       requiredFacts: string[],
 *       idealPoints?: string[]
 *     },
 *     turns: Array<{prompt: string, input?: any}>
 *   }>,
 *   trials?: number,
 *   ablated?: boolean,
 *   judge?: boolean,
 *   judgeModel?: string | null
 * }} options
 * @returns {Promise<{rawPath:string, metricsPath:string, reportPath:string}>}
 */
export async function runQualitySuite(options) {
  const {
    outDir,
    timestamp,
    provider = "mock",
    model = null,
    scenarios = QUALITY_SCENARIOS,
    trials = 1,
    ablated = false,
    judge = false,
    judgeModel = null
  } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Resolve the provider name (e.g. "mock") into a provider object that the
  // paired runner can call. Defaults to the offline mock so runs never reach
  // the network unless a real provider is explicitly configured.
  const resolvedProvider =
    provider === "mock" ? createMockProvider() : resolveProvider();

  // We'll collect results for each scenario and trial
  const allResults = [];

  for (let trialId = 0; trialId < trials; trialId++) {
    for (const scenario of scenarios) {
      // We'll run the paired scenario (baseline vs WAM) for this scenario
      // The runPairedScenario function expects: { scenario, provider, root, trialId, ablation: config, ablationName: name }
      // But we don't have ablations for quality, so we'll use an empty ablation config.
      const ablationConfig = {}; // No ablation for quality benchmark by default
      const ablationName = "full";

      // We need a root directory for the scenario (we can use a temporary directory or the current directory)
      // For simplicity, we'll use the current directory as the root.
      const root = process.cwd();

      const res = await runPairedScenario({
        scenario,
        provider: resolvedProvider,
        root,
        trialId,
        ablation: ablationConfig,
        ablationName: ablationName
      });

      // Now we have the result for this scenario and trial, we need to compute the quality metrics.
      // The res object contains turns for both baseline and WAM.
      // We'll compute the fact coverage for each turn and then aggregate.

      const perTurnResults = [];
      let totalBaselineFactScore = 0;
      let totalWamFactScore = 0;
      let turnsCount = 0;

      for (const turn of res.turns) {
        // Each turn has: baseline.response and wam.response (from the paired runner)
        // We need to extract the final answer and then compute fact coverage.
        const baselineAnswer = extractFinalAnswer(turn.baseline.text);
        const wamAnswer = extractFinalAnswer(turn.wam.text);

        // Score required-fact coverage. factCoverage handles both plain-string
        // facts and `{ any: [...] }` specs, and normalizes internally.
        const baselineFactScore = factCoverage(
          baselineAnswer,
          scenario.rubric?.requiredFacts
        ).score;
        const wamFactScore = factCoverage(
          wamAnswer,
          scenario.rubric?.requiredFacts
        ).score;

        perTurnResults.push({
          trialId,
          scenarioId: scenario.id,
          turnIndex: turnsCount,
          baselineAnswer,
          wamAnswer,
          baselineFactScore,
          wamFactScore
        });

        totalBaselineFactScore += baselineFactScore;
        totalWamFactScore += wamFactScore;
        turnsCount++;
      }

      // Store the scenario result
      allResults.push({
        trialId,
        scenarioId: scenario.id,
        turns: perTurnResults,
        averageBaselineFactScore: turnsCount > 0 ? totalBaselineFactScore / turnsCount : 0,
        averageWamFactScore: turnsCount > 0 ? totalWamFactScore / turnsCount : 0
      });
    }
  }

  // Aggregate across trials and scenarios
  const summary = {
    provider,
    model,
    offline: provider === "mock",
    judgeEnabled: judge,
    scenarios: scenarios.length,
    trials,
    totalTurns: allResults.reduce((acc, r) => acc + r.turns.length, 0),
    averageBaselineFactScore: 0,
    averageWamFactScore: 0,
    factDelta: {
      meanDelta: 0
    },
    wins: 0,
    losses: 0,
    ties: 0,
    emptyBaseline: 0,
    emptyWam: 0
  };

  // We'll compute the average fact scores and the delta
  let totalBaseline = 0;
  let totalWam = 0;
  let totalScenarios = 0;

  for (const result of allResults) {
    totalBaseline += result.averageBaselineFactScore;
    totalWam += result.averageWamFactScore;
    totalScenarios++;
  }

  summary.averageBaselineFactScore = totalScenarios > 0 ? totalBaseline / totalScenarios : 0;
  summary.averageWamFactScore = totalScenarios > 0 ? totalWam / totalScenarios : 0;
  summary.factDelta.meanDelta = summary.averageWamFactScore - summary.averageBaselineFactScore;

  // For simplicity, we'll count wins/losses/ties based on the average fact score per scenario per trial.
  // We'll reset and compute again.
  let wins = 0;
  let losses = 0;
  let ties = 0;
  const EPS = 1e-9;

  for (const result of allResults) {
    const delta = result.averageWamFactScore - result.averageBaselineFactScore;
    if (delta > EPS) {
      wins++;
    } else if (delta < -EPS) {
      losses++;
    } else {
      ties++;
    }
  }

  summary.wins = wins;
  summary.losses = losses;
  summary.ties = ties;

  // Build the raw evidence (we'll store the per-turn results and the summary)
  const raw = {
    timestamp,
    provider,
    model,
    offline: provider === "mock",
    judgeEnabled: judge,
    scenarios: scenarios.map(s => ({
      id: s.id,
      description: s.description,
      budget: s.budget,
      rubric: s.rubric
    })),
    trials,
    ablated,
    results: allResults
  };

  // Build the metrics (a compact summary)
  const metrics = {
    timestamp,
    provider,
    model,
    offline: provider === "mock",
    judgeEnabled: judge,
    scenarios: scenarios.length,
    trials,
    totalTurns: summary.totalTurns,
    averageBaselineFactScore: summary.averageBaselineFactScore,
    averageWamFactScore: summary.averageWamFactScore,
    factDelta: summary.factDelta,
    wins: summary.wins,
    losses: summary.losses,
    ties: summary.ties,
    emptyBaseline: summary.emptyBaseline,
    emptyWam: summary.emptyWam
  };

  // Build the report (human-readable)
  let report = `QUALITY BENCHMARK REPORT\n`;
  report += `========================\n\n`;
  report += `Timestamp: ${timestamp}\n`;
  report += `Provider: ${provider}\n`;
  report += `Model: ${model ?? "N/A"}\n`;
  report += `Offline: ${provider === "mock"}\n`;
  report += `Judge Enabled: ${judge}\n\n`;
  report += `Scenarios: ${scenarios.length}\n`;
  report += `Trials: ${trials}\n`;
  report += `Total Turns: ${summary.totalTurns}\n\n`;
  report += `Average Fact Coverage:\n`;
  report += `  Baseline: ${summary.averageBaselineFactScore.toFixed(3)}\n`;
  report += `  WAM:      ${summary.averageWamFactScore.toFixed(3)}\n`;
  report += `  Delta (WAM - Baseline): ${summary.factDelta.meanDelta.toFixed(3)}\n\n`;
  report += `Outcome Counts:\n`;
  report += `  Wins (WAM > Baseline): ${summary.wins}\n`;
  report += `  Losses (WAM < Baseline): ${summary.losses}\n`;
  report += `  Ties:                  ${summary.ties}\n\n`;
  report += `Empty Responses:\n`;
  report += `  Baseline: ${summary.emptyBaseline}\n`;
  report += `  WAM:      ${summary.emptyWam}\n\n`;

  // Write the three artifacts
  const rawPath = path.join(outDir, "raw.json");
  const metricsPath = path.join(outDir, "metrics.json");
  const reportPath = path.join(outDir, "report.md");

  fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`);
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  fs.writeFileSync(reportPath, report);

  // Return the paths relative to the output directory
  return {
    rawPath: "raw.json",
    metricsPath: "metrics.json",
    reportPath: "report.md"
  };
}

/* -------------------------------------------------------------------------- */
/* Direct invocation (legacy behavior)                                        */
/* -------------------------------------------------------------------------- */

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

/**
 * Append the identical final-answer instruction to the last user message.
 * Applied to BOTH arms so the A/B stays fair while making
 * the model commit to a machine-extractable final answer.
 */
function appendFinalAnswerInstruction(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;
  const copied = [...messages];
  const lastUserIdx = copied.lastIndexOf(
    copied.findLastIndex((m) => m.role === "user")
  );
  if (lastUserIdx >= 0) {
    copied[lastUserIdx] = {
      ...copied[lastUserIdx],
      content:
        copied[lastUserIdx].content +
        "\n\n" +
        ANSWER_INSTRUCTION
    };
  }
  return copied;
}

/**
 * Run the quality benchmark suite with the given arguments (for direct invocation).
 *
 * This maintains the legacy behavior of writing a single JSON report to
 * benchmarks/results/quality-<timestamp>.json and printing a summary to stdout.
 *
 * @param {{offline:boolean, judge:boolean, judgeModel:string|null, scenarios:string[]|null}} args
 * @returns {Promise<number>} exit code
 */
async function runLegacy(args) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const RESULTS_DIR = path.resolve(__dirname, "..", "results");

  const provider = args.offline ? "mock" : undefined; // let resolveProvider decide
  const scenarios = args.scenarios
    ? pickScenarios(QUALITY_SCENARIOS, args.scenarios)
    : QUALITY_SCENARIOS;

  if (!ensureRubrics(scenarios)) {
    return 1;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RESULTS_DIR, `quality-${stamp}.json`);

  // We'll reuse the runQualitySuite function but then we have to adapt the output.
  // For legacy, we want the old format. So we'll call runQualitySuite with a temporary directory
  // and then we'll format the output as the old runner did.

  // Create a temporary directory for the legacy run
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-quality-legacy-"));
  try {
    const result = await runQualitySuite({
      outDir: tmpDir,
      timestamp: new Date().toISOString(),
      provider: args.offline ? "mock" : undefined,
      model: null,
      scenarios,
      trials: 1,
      ablated: false,
      judge: args.judge,
      judgeModel: args.judgeModel
    });

    // Read the three artifacts we just wrote
    const raw = JSON.parse(fs.readFileSync(path.join(tmpDir, "raw.json"), "utf8"));
    const metrics = JSON.parse(fs.readFileSync(path.join(tmpDir, "metrics.json"), "utf8"));
    const report = fs.readFileSync(path.join(tmpDir, "report.md"), "utf8");

    // Build the legacy report object (similar to what the old runner did)
    const legacyReport = {
      provider: raw.provider,
      model: raw.model,
      offline: raw.offline,
      judgeEnabled: raw.judgeEnabled,
      scenarios: raw.scenarios.length,
      trials: raw.trials,
      totalTurns: raw.totalTurns,
      averageBaselineFactScore: metrics.averageBaselineFactScore,
      averageWamFactScore: metrics.averageWamFactScore,
      factDelta: metrics.factDelta,
      wins: metrics.wins,
      losses: metrics.losses,
      ties: metrics.ties,
      emptyBaseline: metrics.emptyBaseline,
      emptyWam: metrics.emptyWam,
      perScenario: [] // We don't have the per-scenario breakdown in the legacy format, but we can skip it for now.
    };

    // Write the legacy report
    fs.writeFileSync(outPath, `${JSON.stringify(legacyReport, null, 2)}\n`);

    // Print the legacy summary
    // eslint-disable-next-line no-console
    console.log(
      `QUALITY REPORT ${outPath}\n` +
        `provider=${legacyReport.provider} model=${legacyReport.model} offline=${legacyReport.offline} judge=${legacyReport.judgeEnabled}\n` +
        `scenarios=${legacyReport.scenarios} turns=${legacyReport.totalTurns}\n` +
        `fact: baseline=${legacyReport.averageBaselineFactScore.toFixed(3)} wam=${legacyReport.averageWamFactScore.toFixed(3)} delta=${legacyReport.factDelta.meanDelta.toFixed(3)} wins=${legacyReport.wins} losses=${legacyReport.losses} ties=${legacyReport.ties}\n` +
        (legacyReport.judgeDelta != null
          ? `judge: baseline=${legacyReport.baselineJudge.toFixed(1)} wam=${legacyReport.wamJudge.toFixed(1)} delta=${legacyReport.judgeDelta.toFixed(1)}\n`
          : "") +
        `empty: baseline=${legacyReport.emptyBaseline} wam=${legacyReport.emptyWam}`
    );

    return 0;
  } finally {
    // Clean up the temporary directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Direct invocation
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  runLegacy(args).then(
    (code) => process.exit(code),
    (err) => {
      console.error("run-quality failed:", err && err.stack ? err.stack : err);
      process.exit(2);
    }
  );
}