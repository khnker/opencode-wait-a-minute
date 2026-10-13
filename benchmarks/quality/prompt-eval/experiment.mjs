/**
 * Experiment runner for the prompt-policy experiment pack.
 *
 * Runs the DETERMINISTIC evaluation of recorded outputs for a suite + prompt
 * variant and writes reproducible, timestamp-free evidence under
 * `experiments/<experimentId>/`:
 *
 *   - config.json : suite id/version, configHash, coverageHash, evaluator/oracle
 *                   version and the variant id.
 *   - report.json : per-scenario + per-criterion verdict evidence, using the
 *                   same shape as `run.mjs` (`{ runId, labels, scenarios }`).
 *   - cost.json   : `{ tokens, latencyMs, executionFailures, source }`.
 *
 * COST HONESTY INVARIANT: the deterministic harness has no token/latency data.
 * Unless run artifacts explicitly carry it, `cost.json` records
 * `tokens: null, latencyMs: null, source: "unavailable"` with a reason. The
 * runner NEVER fabricates token or latency numbers.
 *
 * DETERMINISM INVARIANT: `experimentId`, `config.json` and `report.json` are
 * byte-identical across repeats (no timestamps, no durations).
 */

import fs from "node:fs";
import path from "node:path";
import { hashContent } from "./snapshot.mjs";
import { evaluateScenario } from "./deterministic.mjs";
import { aggregateMetrics } from "./metrics.mjs";
import { compareRuns } from "./compare.mjs";
import { coverageOf, listSuites } from "./freeze-baseline.mjs";
import { validateDataset } from "./schema.mjs";

export const EXPERIMENT_SCHEMA = "wam.prompt-eval.experiment/1";
export const REPORT_SCHEMA = "wam.prompt-eval.report/1";
export const RUN_SCHEMA = "wam.prompt-eval.run/1";
export const EVALUATOR_VERSION = "1.0.0";
export const ORACLE_VERSION = "1.0.0";
export const COST_UNAVAILABLE_REASON = "no token/latency data in run artifacts";

/** Stable serialization used for every written artifact. */
export function serializeArtifact(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function canonical(value) {
  return JSON.stringify(value, null, 2);
}

/**
 * Reproducible configuration hash: identical for baseline and candidate of the
 * same suite/coverage/evaluator, so they remain comparable. The variant is
 * captured by prompt content hashes, never by the config hash.
 */
export function computeConfigHash({ suite, coverageHash }) {
  return hashContent(
    canonical({
      suite: { id: suite.id, version: suite.version },
      coverageHash,
      evaluatorVersion: EVALUATOR_VERSION,
      oracleVersion: ORACLE_VERSION,
    }),
  );
}

/** Deterministic, timestamp-free experiment id. */
export function deriveExperimentId({ suiteId, variant, configHash, coverageHash }) {
  return `${suiteId}--${variant}--${configHash.slice(0, 12)}--${coverageHash.slice(0, 12)}`;
}

/**
 * Build an honest cost record. Only run artifacts may carry token/latency data;
 * otherwise the runner must say so rather than invent numbers.
 */
export function buildCost({ tokens, latencyMs, executionFailures = 0, reason } = {}) {
  if (tokens == null && latencyMs == null) {
    return {
      tokens: null,
      latencyMs: null,
      executionFailures,
      source: "unavailable",
      reason: reason || COST_UNAVAILABLE_REASON,
    };
  }
  return {
    tokens: tokens ?? null,
    latencyMs: latencyMs ?? null,
    executionFailures,
    source: "run",
  };
}

function selectSuites({ suiteId, suites }) {
  const all = suites || listSuites();
  const selected = suiteId && suiteId !== "core"
    ? all.filter((s) => s.id === suiteId)
    : all;
  if (selected.length === 0) {
    throw new Error(`prompt-eval: no suite found for id "${suiteId}"`);
  }
  validateDataset(selected);
  return selected;
}

function aggregateSuite(selected) {
  return {
    id: selected.length === 1 ? selected[0].id : "core",
    version: selected.length === 1 ? selected[0].version : "1.0.0",
    scenarios: selected.flatMap((s) => s.scenarios),
  };
}

function promptRecords(promptContents) {
  return Object.entries(promptContents || {})
    .map(([id, record]) => {
      const body = record && typeof record === "object" && "content" in record
        ? record.content
        : record;
      if (typeof body !== "string") {
        throw new TypeError(`prompt-eval: promptContents["${id}"] must be a string or { content }`);
      }
      return { id, hash: hashContent(body) };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Run one experiment arm.
 *
 * @param {{ suiteId?: string, variant: string,
 *   promptContents: Record<string, string>,
 *   outputs?: Record<string, string>,
 *   suites?: object[],
 *   cost?: { tokens?: number|null, latencyMs?: number|null, executionFailures?: number } }} args
 * @returns {{ experimentId: string, variant: string, config: object,
 *   report: object, cost: object, run: object }}
 */
export function runExperiment({
  suiteId = "core",
  variant,
  promptContents,
  outputs = {},
  suites,
  cost,
}) {
  if (typeof variant !== "string" || variant.trim() === "") {
    throw new TypeError("prompt-eval: runExperiment requires a non-empty variant id");
  }
  const selected = selectSuites({ suiteId, suites });
  const aggregate = aggregateSuite(selected);
  const coverage = coverageOf(selected);
  const configHash = computeConfigHash({ suite: aggregate, coverageHash: coverage.hash });
  const experimentId = deriveExperimentId({
    suiteId: aggregate.id,
    variant,
    configHash,
    coverageHash: coverage.hash,
  });

  const results = [];
  const details = [];
  let executionFailures = 0;

  for (const scenario of aggregate.scenarios) {
    const output = outputs ? outputs[scenario.id] : undefined;
    if (output == null) executionFailures += 1;
    const evaluated = evaluateScenario(scenario, output);
    const verdicts = evaluated.criteria || [];
    results.push({ scenario, verdicts });
    details.push({
      scenarioId: scenario.id,
      severity: scenario.severity,
      passed: evaluated.passed,
      evaluable: evaluated.evaluable,
      criteria: (scenario.criteria || []).map((c) => {
        const v = verdicts.find((x) => x.criterionId === c.id) || {};
        return {
          criterionId: c.id,
          required: c.required,
          passed: v.passed,
          evaluable: v.evaluable,
          evidence: v.evidence,
        };
      }),
    });
  }

  const aggregateMetricsResult = aggregateMetrics(results);
  const metrics = {
    evaluableCount: aggregateMetricsResult.evaluableCount ?? 0,
    totalScenarios: aggregateMetricsResult.totalScenarios ?? 0,
    mandatoryCompliance: aggregateMetricsResult.mandatoryCompliance ?? 0,
    targetChecksPassed: aggregateMetricsResult.targetChecksPassed ?? 0,
    criticalRegressions: aggregateMetricsResult.criticalRegressions ?? 0,
  };

  const prompts = promptRecords(promptContents);

  const config = {
    schema: EXPERIMENT_SCHEMA,
    experimentId,
    suite: { id: aggregate.id, version: aggregate.version },
    variant,
    configHash,
    coverageHash: coverage.hash,
    evaluatorVersion: EVALUATOR_VERSION,
    oracleVersion: ORACLE_VERSION,
    coverage: {
      scenarios: coverage.scenarios,
      requiredCriteria: coverage.requiredCriteria,
    },
  };

  const report = {
    schema: REPORT_SCHEMA,
    runId: experimentId,
    experimentId,
    variant,
    suite: { id: aggregate.id, version: aggregate.version },
    configHash,
    coverageHash: coverage.hash,
    labels: [variant],
    scenarios: details,
  };

  const costRecord = buildCost({
    tokens: cost ? cost.tokens : undefined,
    latencyMs: cost ? cost.latencyMs : undefined,
    executionFailures: cost && cost.executionFailures != null
      ? cost.executionFailures
      : executionFailures,
    reason: cost ? cost.reason : undefined,
  });

  const run = {
    schema: RUN_SCHEMA,
    runId: experimentId,
    labels: [
      {
        label: variant,
        suite: { id: aggregate.id, version: aggregate.version },
        configHash,
        prompts,
        metrics,
        details,
      },
    ],
  };

  return { experimentId, variant, config, report, cost: costRecord, run };
}

/** Serialize the three evidence artifacts for an experiment arm. */
export function experimentArtifacts(evidence) {
  return {
    config: serializeArtifact(evidence.config),
    report: serializeArtifact(evidence.report),
    cost: serializeArtifact(evidence.cost),
  };
}

/**
 * Write `config.json`, `report.json` and `cost.json` under
 * `<outDir>/<experimentId>/`. Deterministic core (config/report) is
 * byte-identical across repeats.
 */
export function writeExperiment(evidence, outDir) {
  const dir = path.join(outDir, evidence.experimentId);
  const artifacts = experimentArtifacts(evidence);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ["config", "report", "cost"]) {
    fs.writeFileSync(path.join(dir, `${name}.json`), artifacts[name], "utf8");
  }
  return {
    dir,
    configPath: path.join(dir, "config.json"),
    reportPath: path.join(dir, "report.json"),
    costPath: path.join(dir, "cost.json"),
  };
}

/**
 * Compare a baseline arm against a candidate arm. Reuses `compareRuns`, so
 * mismatched suite id/version, config hash or coverage are rejected before any
 * decision is produced (PQ-EXP-07).
 */
export function compareExperiments(baselineEvidence, candidateEvidence) {
  return compareRuns(baselineEvidence.run, candidateEvidence.run);
}

/**
 * Promotion decision. A critical regression VETOES the candidate regardless of
 * token savings: cost never offsets a regression (PQ-EXP-08).
 */
export function evaluateCandidate(baselineEvidence, candidateEvidence) {
  const comparison = compareExperiments(baselineEvidence, candidateEvidence);
  const decision = comparison.decision.decision;
  const vetoed = decision === "REGRESSION";
  return {
    ...comparison,
    vetoed,
    cost: {
      baseline: baselineEvidence.cost,
      candidate: candidateEvidence.cost,
    },
  };
}

export const EXPERIMENTS_DIR = "experiments";

/** Default evidence directory: `benchmarks/quality/prompt-eval/experiments`. */
export function defaultExperimentsDir() {
  return path.join(path.dirname(new URL(import.meta.url).pathname), EXPERIMENTS_DIR);
}
