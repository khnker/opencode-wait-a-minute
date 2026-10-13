/**
 * Deterministic baseline freezer for the prompt-quality benchmark.
 *
 * Builds a timestamp-free, byte-identical-across-repeats baseline record for a
 * suite (or the whole `core` catalog) from the RECORDED baseline fixtures.
 * The record captures the suite id/version + content hash, the configuration
 * hash, the coverage hash (scenario ids + required criterion ids) and the
 * resulting metrics (PQ-EXP-05).
 *
 * Reproduce with:  node benchmarks/quality/prompt-eval/freeze-baseline.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashContent, freezeRun } from "./snapshot.mjs";
import { evaluateScenario } from "./deterministic.mjs";
import { aggregateMetrics } from "./metrics.mjs";
import { loadPrompt } from "../../../src/prompts/loader.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(HERE, "suites");
const OUTPUTS_DIR = path.join(HERE, "outputs");
const BASELINES_DIR = path.join(HERE, "baselines");

export const BASELINE_SCHEMA = "wam.prompt-eval.baseline/1";
export const BASELINE_LABEL = "baseline";

export function listSuites() {
  return fs
    .readdirSync(SUITES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(SUITES_DIR, file), "utf8")));
}

function loadBaselineOutputs(suites) {
  const merged = {};
  for (const suite of suites) {
    const fixturePath = path.join(OUTPUTS_DIR, `${BASELINE_LABEL}__${suite.id}.json`);
    if (fs.existsSync(fixturePath)) {
      Object.assign(merged, JSON.parse(fs.readFileSync(fixturePath, "utf8")));
    }
  }
  return merged;
}

export function coverageOf(suites) {
  const scenarios = [];
  const requiredCriteria = [];
  for (const suite of suites) {
    for (const scenario of suite.scenarios) {
      scenarios.push(scenario.id);
      for (const criterion of scenario.criteria) {
        if (criterion.required) requiredCriteria.push(criterion.id);
      }
    }
  }
  scenarios.sort();
  requiredCriteria.sort();
  return {
    scenarios,
    requiredCriteria,
    hash: hashContent(JSON.stringify({ scenarios, requiredCriteria })),
  };
}

/**
 * Build the baseline record. With no `suiteId`, aggregates every suite as
 * `core`; otherwise builds a single suite. Pure and deterministic.
 *
 * @param {{ suiteId?: string }} [options]
 * @returns {object}
 */
export function buildBaseline({ suiteId } = {}) {
  const all = listSuites();
  const suites = suiteId ? all.filter((suite) => suite.id === suiteId) : all;
  if (suites.length === 0) {
    throw new Error(`prompt-eval: no suite found for id "${suiteId}"`);
  }

  const aggregateSuite = {
    id: suites.length === 1 ? suites[0].id : "core",
    version: suites.length === 1 ? suites[0].version : "1.0.0",
    scenarios: suites.flatMap((suite) => suite.scenarios),
  };

  const promptRefs = new Set();
  suites.forEach((suite) => suite.scenarios.forEach((scenario) => promptRefs.add(scenario.promptRef)));
  const promptContents = {};
  [...promptRefs].sort().forEach((ref) => {
    promptContents[ref] = loadPrompt(ref);
  });

  const frozen = freezeRun({ suite: aggregateSuite, promptContents, config: {} });
  const outputs = loadBaselineOutputs(suites);

  const results = [];
  for (const suite of suites) {
    for (const scenario of suite.scenarios) {
      const verdicts = evaluateScenario(scenario, outputs[scenario.id]).criteria;
      results.push({ scenario, verdicts });
    }
  }

  return {
    schema: BASELINE_SCHEMA,
    label: BASELINE_LABEL,
    suite: { id: frozen.suite.id, version: frozen.suite.version, hash: frozen.suite.hash },
    configHash: frozen.configHash,
    coverage: coverageOf(suites),
    prompts: frozen.prompts.map((prompt) => ({ id: prompt.id, hash: prompt.hash })),
    metrics: aggregateMetrics(results),
  };
}

export function serializeBaseline(baseline) {
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

/**
 * Write `baselines/<suite>.json` for every suite plus the aggregate
 * `baselines/core.json`. Returns the written paths.
 */
export function freezeBaselines() {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });
  const written = [];
  for (const suite of listSuites()) {
    const target = path.join(BASELINES_DIR, `${suite.id}.json`);
    fs.writeFileSync(target, serializeBaseline(buildBaseline({ suiteId: suite.id })), "utf8");
    written.push(target);
  }
  const coreTarget = path.join(BASELINES_DIR, "core.json");
  fs.writeFileSync(coreTarget, serializeBaseline(buildBaseline()), "utf8");
  written.push(coreTarget);
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const written = freezeBaselines();
  console.log(`Froze ${written.length} baseline file(s):`);
  for (const file of written) console.log(` - ${path.relative(HERE, file)}`);
}
