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
 * @param {{ labels: string[], suites: object[], promptContents: Record<string, Record<string, string>>, root?: string, outDir?: string, writeWallclock?: boolean }} args
 * @returns {{ runId: string, run: object, artifacts: { runPath: string, reportPath: string, wallclockPath?: string } }}
 */
export function runEvaluation({
  labels,
  suites,
  promptContents,
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

  const runRecord = {
    schema: "wam.prompt-eval.run/1",
    runId,
    labels: records.map(({ label, frozen }) => ({
      label,
      suite: { ...frozen.suite },
      configHash: frozen.configHash,
      prompts: [...frozen.prompts],
      metrics: frozen.metrics || {},
      details: frozen.details || [],
    })),
  };

  const runPath = path.join(resolvedOutDir, runId, "run.json");
  const reportPath = path.join(resolvedOutDir, runId, "report.json");
  
  writeArtifact(runPath, serializeReport(runRecord));
  writeArtifact(reportPath, serializeReport({ runId, labels: labels, scenarios: [] }));

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
