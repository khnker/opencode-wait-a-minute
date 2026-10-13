/**
 * Deterministic run-record writer for the prompt-quality benchmark.
 *
 * Executes the (deterministic) evaluation for a set of labels
 * (baseline / candidate) and writes a versioned run record plus
 * JSON artifacts under `benchmarks/quality/prompt-eval/runs/<runId>/`.
 *
 * Determinism invariant: the serialized core (run.json,
 * report.json) is byte-identical across repeats. No timestamps
 * and no durations live in the core; wall-clock may be written
 * to an ignored sidecar (`wallclock.json`) if requested.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateDataset } from "./schema.mjs";
import { freezeRun } from "./snapshot.mjs";
import { evaluateScenario } from "./deterministic.mjs";
import { aggregateMetrics } from "./metrics.mjs";

const RUNS_DIR_NAME = "runs";

export function serializeReport(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function defaultRoot() {
  return path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
}

function defaultOutDir(root) {
  return path.join(fileURLToPath(new URL(".", import.meta.url)), RUNS_DIR_NAME);
}

function deriveRunId({ label, configHash, suiteHash, promptsHash }) {
  return `${label}--${configHash.slice(0, 12)}--${suiteHash.slice(0, 12)}--${promptsHash.slice(0, 12)}`;
}

function writeArtifact(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

/**
 * Run the deterministic evaluation for each label and write the
 * frozen run records + reports under `runs/<runId>/`.
 *
 * @param {{ labels: string[], suites: object[], promptContents: Record<string, Record<string, string>>, outputsByLabel: Record<string, Record<string, string>>, root?: string, outDir?: string, writeWallclock?: boolean }} args
 * @returns {{ runId: string, run: object, artifacts: { runPath: string, reportPath: string, wallclockPath?: string } }}
 */
export function runEvaluation({
  labels,
  suites,
  promptContents,
  outputsByLabel,
  root,
  outDir,
  writeWallclock = false,
}) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new TypeError("prompt-eval: runEvaluation requires a non-empty labels array");
  }
  if (!Array.isArray(suites) || suites.length === 0) {
    throw new TypeError("prompt-eval: runEvaluation requires a non-empty suites array");
  }
  validateDataset(suites);

  const resolvedRoot = root || defaultRoot();
  const resolvedOutDir = outDir || defaultOutDir(resolvedRoot);

  // Aggregate a virtual suite for 'core' or multi-suite runs to ensure consistent hashing
  const aggregateSuite = {
    id: suites.length === 1 ? suites[0].id : "core",
    version: suites.length === 1 ? suites[0].version : "1.0.0",
    scenarios: suites.flatMap(s => s.scenarios),
  };

  const records = labels.map((label) => {
    const contentsForLabel = promptContents && promptContents[label];
    if (!contentsForLabel || typeof contentsForLabel !== "object") {
      throw new TypeError(
        `prompt-eval: promptContents missing an entry for label "${label}"`,
      );
    }
    // Pass aggregateSuite to freezeRun to capture all scenarios in the hash
    return { label, frozen: freezeRun({ suite: aggregateSuite, promptContents: contentsForLabel }) };
  });

  const promptsHash = records
    .map(({ frozen }) => frozen.prompts.map((p) => p.hash).join(","))
    .join("|");

  const first = records[0];
  const runId = deriveRunId({
    label: first.label,
    configHash: first.frozen.configHash,
    suiteHash: first.frozen.suite.hash,
    promptsHash,
  });

  // Evaluate every scenario and populate metrics and details
  const allScenariosResults = [];
  const runRecords = records.map(({ label, frozen }) => ({
    label,
    suite: { ...frozen.suite, scenarios: aggregateSuite.scenarios },
    configHash: frozen.configHash,
    prompts: [...frozen.prompts],
    metrics: {},
    details: [],
  }));

  for (let labelIdx = 0; labelIdx < labels.length; labelIdx++) {
    const label = labels[labelIdx];
    const outputsForLabel = outputsByLabel && outputsByLabel[label] || {};
    const scenarios = aggregateSuite.scenarios || [];

    for (const scenario of scenarios) {
      const output = outputsForLabel[scenario.id];
      const result = evaluateScenario(scenario, output);
      allScenariosResults.push({
        label,
        scenario: {
          id: scenario.id,
          severity: scenario.severity,
          criteria: scenario.criteria,
          suite: scenario.suite,
        },
        verdicts: result.criteria.map(cr => ({
          criterionId: cr.criterionId,
          passed: cr.passed,
          evaluable: cr.evaluable,
          evidence: cr.evidence,
        })),
      });
    }
  }

  for (let labelIdx = 0; labelIdx < labels.length; labelIdx++) {
    const label = labels[labelIdx];
    const labelResults = allScenariosResults.filter(r => r.label === label);
    const labelMetrics = aggregateMetrics(labelResults);
    const labelDetails = [];
    for (const r of labelResults) {
      labelDetails.push({
        scenarioId: r.scenario.id,
        severity: r.scenario.severity,
        passed: r.verdicts.every(v => {
          const crit = r.scenario.criteria.find(c => c.id === v.criterionId);
          if (!crit || !crit.required) return true;
          return v.passed;
        }) && r.verdicts.every(v => {
          const crit = r.scenario.criteria.find(c => c.id === v.criterionId);
          if (crit && crit.kind === 'must-not') return v.passed;
          return true;
        }),
        evaluable: r.verdicts.some(v => v.evaluable),
        criteria: r.verdicts.map(v => ({
          criterionId: v.criterionId,
          kind: r.scenario.criteria.find(c => c.id === v.criterionId).kind,
          passed: v.passed,
          evaluable: v.evaluable,
          evidence: v.evidence,
        })),
      });
    }
    runRecords[labelIdx].metrics = {
      evaluableCount: labelMetrics.evaluableCount,
      totalScenarios: labelMetrics.totalScenarios,
      mandatoryCompliance: labelMetrics.mandatoryCompliance,
      targetChecksPassed: labelMetrics.targetChecksPassed,
      criticalRegressions: labelMetrics.criticalRegressions,
    };
    runRecords[labelIdx].details = labelDetails;
  }

  const runRecord = {
    schema: "wam.prompt-eval.run/1",
    runId,
    labels: runRecords,
  };

  const runPath = path.join(resolvedOutDir, runId, "run.json");
  const reportPath = path.join(resolvedOutDir, runId, "report.json");
  
  writeArtifact(runPath, serializeReport(runRecord));
  writeArtifact(reportPath, serializeReport({ runId, labels: runRecord.labels.map(l => l.label), scenarios: [] }));

  if (writeWallclock) {
    const wallclockPath = path.join(resolvedOutDir, runId, "wallclock.json");
    writeArtifact(wallclockPath, serializeReport({ timestamp: new Date().toISOString() }));
  }

  return {
    runId,
    run: runRecord,
    artifacts: { runPath, reportPath },
  };
}
