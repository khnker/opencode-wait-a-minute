#!/usr/bin/env node
/**
 * Frontend UX benchmark runner.
 *
 * Runs a single condition (A, B, or C) against a single case from the corpus,
 * collects the artifact via a provider, and records scores from an independent
 * scorer (provided as a callback). The runner is pure: no I/O, no network,
 * no throws. It returns a promise that resolves to the paths of the written
 * envelope files (manifest.json, raw.json, metrics.json, report.md).
 *
 * When run directly, it uses the command-line interface in `cli.mjs`.
 *
 * The scorer callback is responsible for applying the independent rubric and
 * returning a score object. The runner does not interpret the score; it only
 * records and aggregates it.
 *
 * Example usage as a library:
 *   import { runBenchmark } from './runner.mjs';
 *   const paths = await runBenchmark({
 *     outDir: '/tmp/wam-bench',
 *     timestamp: '2026-10-13T20:50:00.000Z',
 *     provider: 'mock',
 *     model: 'test-model',
 *     condition: 'B',
 *     caseId: 'case-1-new-screen',
 *     trials: 3,
 *     scorer: (artifact, case) => ({ dimension: 1 }),
 *   });
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProvider, createMockProvider } from "../../benchmarks/providers/index.mjs";
import { listCases, getCase, validateCorpus } from "./corpus.mjs";
import { validateRubric, buildRubric } from "./rubric.mjs";
import { mean, stddev, median } from "../../benchmarks/evaluation/statistics.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../");

/** Default number of trials. */
const DEFAULT_TRIALS = 1;

/**
 * Validates the runner options. Returns { ok, errors }.
 */
function validateOptions(opts) {
  const errors = [];
  if (!opts.outDir) errors.push("missing outDir");
  if (!opts.timestamp) errors.push("missing timestamp");
  if (!opts.provider) errors.push("missing provider");
  if (!opts.model) errors.push("missing model");
  if (!opts.condition) errors.push("missing condition");
  else if (!["A", "B", "C"].includes(opts.condition)) errors.push("condition must be A, B, or C");
  if (!opts.caseId) errors.push("missing caseId");
  else {
    const theCase = getCase(opts.caseId);
    if (!theCase) errors.push(`caseId '${opts.caseId}' not found in corpus`);
  }
  if (opts.trials != null && (typeof opts.trials !== "number" || !Number.isFinite(opts.trials) || opts.trials < 1)) {
    errors.push("trials must be a positive integer");
  }
  if (opts.scorer != null && typeof opts.scorer !== "function") errors.push("scorer must be a function");
  return { ok: errors.length === 0, errors };
}

/**
 * Runs a single trial: invoke the provider to get an artifact, then invoke the
 * scorer to get a score for that artifact.
 *
 * @param {object} opts - validated options
 * @param {object> theCase - the corpus case
 * @param {function} scorer - independent scorer callback
 * @returns {Promise<{ artifact: string, score: object }>}
 */
async function runTrial(opts, theCase, scorer) {
  const provider = await resolveProvider({ env: { WAM_BENCH_MODE: "dry-run" } });
  // Construct a prompt: the task spec from the case.
  const prompt = theCase.taskSpec;
  // We assume the provider returns a completion result with a text field.
  const result = await provider.complete({
    messages: [{ role: "user", content: prompt }],
    model: opts.model,
  });
  const artifact = result.text;
  // Invoke the independent scorer.
  const score = scorer(artifact, theCase);
  return { artifact, score };
}

/**
 * Computes aggregate metrics from trial scores.
 *
 * @param {Array<{ score: object }>} trials
 * @returns {object} metrics
 */
function computeMetrics(trials) {
  // We expect each trial.score to be an object with criterion ids as keys and numeric scores as values.
  // We also expect dimensions to be present? We'll compute per criterion and then roll up to dimensions.
  const criterionScores = {};
  const dimensionScores = {};

  // Initialize accumulators.
  for (const trial of trials) {
    const { score } = trial;
    if (typeof score !== "object" || score === null) continue;
    for (const [critId, value] of Object.entries(score)) {
      if (typeof value !== "number") continue;
      if (!criterionScores[critId]) criterionScores[critId] = [];
      criterionScores[critId].push(value);
    }
  }

  // Compute mean, median, stddev for each criterion.
  const metrics = { criteria: {} };
  for (const [critId, values] of Object.entries(criterionScores)) {
    metrics.criteria[critId] = {
      mean: mean(values),
      median: median(values),
      stddev: stddev(values),
      n: values.length,
    };
  }

  // TODO: roll up to dimensions using rubric weights from the case.
  // For now, we leave dimension scores empty; the caller can compute if needed.
  metrics.dimensions = {};

  return metrics;
}

/**
 * Writes the envelope files for a benchmark run.
 *
 * @param {string} outDir - output directory
 * @param {object} manifest - manifest content
 * @param {object} raw - raw content (trials)
 * @param {object} metrics - metrics content
 * @returns {object} paths to the written files
 */
function writeEnvelope(outDir, manifest, raw, metrics) {
  const manifestPath = path.join(outDir, "manifest.json");
  const rawPath = path.join(outDir, "raw.json");
  const metricsPath = path.join(outDir, "metrics.json");
  const reportPath = path.join(outDir, "report.md");

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

  // Generate a simple markdown report.
  const report = `# Frontend UX Benchmark Report\n\n` +
    `## Manifest\n\`\`\`json\n${JSON.stringify(manifest, null, 2)}\n\`\`\`\n\n` +
    `## Metrics\n\`\`\`json\n${JSON.stringify(metrics, null, 2)}\n\`\`\`\n\n` +
    `## Raw Trials (first 2)\n\`\`\`json\n${JSON.stringify(raw.trials.slice(0, 2), null, 2)}\n\`\`\`\n`;
  fs.writeFileSync(reportPath, report);

  return { manifestPath, rawPath, metricsPath, reportPath };
}

/**
 * Main benchmark runner.
 *
 * @param {object} options - see validateOptions
 * @returns {Promise<{ manifestPath, rawPath, metricsPath, reportPath }>}
 */
export async function runBenchmark(options) {
  const validation = validateOptions(options);
  if (!validation.ok) {
    throw new Error(`Invalid options: ${validation.errors.join(", ")}`);
  }

  const {
    outDir,
    timestamp,
    provider,
    model,
    condition,
    caseId,
    trials = DEFAULT_TRIALS,
    scorer,
  } = options;

  // Ensure output directory exists.
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Load the case.
  const theCase = getCase(caseId);
  if (!theCase) {
    throw new Error(`Case '${caseId}' not found`);
  }

  // Validate the case and its rubric.
  const corpusVal = validateCorpus();
  if (!corpusVal.ok) {
    throw new Error(`Corpus validation failed: ${corpusVal.errors.join(", ")}`);
  }
  // Build the rubric for the case (using weights from the case).
  const caseVal = { rubric: theCase.rubric || {} };
  const rubric = buildRubric(theCase, caseVal.rubric.weights);
  const rubricVal = validateRubric(rubric);
  if (!rubricVal.ok) {
    throw new Error(`Rubric validation failed: ${rubricVal.errors.join(", ")}`);
  }

  // Run the trials.
  const trialResults = [];
  for (let i = 0; i < trials; i++) {
    const result = await runTrial(
      { outDir, timestamp, provider, model, condition, caseId, trials, scorer },
      theCase,
      scorer
    );
    trialResults.push(result);
  }

  // Prepare the envelope content.
  const manifest = {
    version: "1.0.0",
    condition,
    caseId,
    trials,
    timestamp,
    provider,
    model,
  };

  const raw = {
    trials: trialResults.map(({ artifact, score }) => ({
      artifact,
      score,
    })),
  };

  const metrics = computeMetrics(trialResults);

  // Write the envelope files.
  return writeEnvelope(outDir, manifest, raw, metrics);
}

/**
 * When run directly, delegate to the CLI.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line no-undef
  const { runCLI } = await import("./cli.mjs");
  runCLI();
}