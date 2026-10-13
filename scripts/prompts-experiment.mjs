#!/usr/bin/env node
/**
 * Experiment CLI for the prompt-policy experiment pack.
 *
 * Runs one suite + prompt variant through the deterministic evaluator and
 * writes honest evidence under
 * `benchmarks/quality/prompt-eval/experiments/<experimentId>/`.
 *
 * Usage:
 *   node scripts/prompts-experiment.mjs --suite <id|core> --variant <V1|S1|P1|D1|baseline> \
 *     [--outputs <baseline|candidate>] [--outDir <dir>]
 *
 * Variant semantics:
 *   - V1/S1/P1/D1 substitute the experimental prompt
 *     (`prompts/experiments/<policy>/<variant>.md`) for the matching promptRef.
 *   - baseline keeps the active prompts and is the comparison anchor.
 *
 * Cost is left `unavailable` (null tokens/latency): the deterministic harness
 * has no usage data and this CLI never fabricates it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPrompt } from "../src/prompts/loader.js";
import { listSuites } from "../benchmarks/quality/prompt-eval/freeze-baseline.mjs";
import {
  runExperiment,
  writeExperiment,
  defaultExperimentsDir,
} from "../benchmarks/quality/prompt-eval/experiment.mjs";

const VARIANT_POLICY = Object.freeze({
  V1: "verify",
  S1: "scope",
  P1: "simplify",
  D1: "delegation",
});

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--suite")) {
      result.suite = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--variant")) {
      result.variant = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--outputs")) {
      result.outputs = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--outDir")) {
      result.outDir = arg.includes("=") ? arg.split("=")[1] : args[++i];
    }
  }
  return result;
}

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);
const {
  suite: suiteName = "core",
  variant,
  outputs: outputsLabel = "candidate",
  outDir,
} = parseArgs(args);

if (!variant) {
  console.error(
    "Usage: node scripts/prompts-experiment.mjs --suite <id|core> --variant <V1|S1|P1|D1|baseline> [--outputs <baseline|candidate>] [--outDir <dir>]",
  );
  process.exit(1);
}

const policy = VARIANT_POLICY[variant];
if (policy === undefined && variant !== "baseline") {
  console.error(`Unknown variant "${variant}" (expected V1|S1|P1|D1|baseline)`);
  process.exit(1);
}

const allSuites = listSuites();
const suites = suiteName === "core"
  ? allSuites
  : allSuites.filter((s) => s.id === suiteName);
if (suites.length === 0) {
  console.error(`Suite not found: ${suiteName}`);
  process.exit(1);
}

let variantContent = null;
let variantPath = null;
if (policy) {
  variantPath = path.join(root, "prompts", "experiments", policy, `${variant}.md`);
  if (!fs.existsSync(variantPath)) {
    console.error(`Variant prompt not found: ${variantPath}`);
    process.exit(1);
  }
  variantContent = fs.readFileSync(variantPath, "utf8");
}

const promptRefs = new Set();
suites.forEach((suite) => suite.scenarios.forEach((s) => promptRefs.add(s.promptRef)));

const promptContents = {};
for (const ref of promptRefs) {
  const useVariant = policy && ref.toLowerCase().includes(policy);
  promptContents[ref] = useVariant ? variantContent : loadPrompt(ref);
}

const outputsDir = path.join(root, "benchmarks/quality/prompt-eval/outputs");
const outputs = {};
for (const suite of suites) {
  const fixturePath = path.join(outputsDir, `${outputsLabel}__${suite.id}.json`);
  if (fs.existsSync(fixturePath)) {
    Object.assign(outputs, JSON.parse(fs.readFileSync(fixturePath, "utf8")));
  }
}

const evidence = runExperiment({
  suiteId: suiteName,
  variant,
  promptContents,
  outputs,
  suites,
});

const targetDir = outDir ? path.resolve(outDir) : defaultExperimentsDir();
const written = writeExperiment(evidence, targetDir);

console.log(`Experiment completed: ${evidence.experimentId}`);
console.log(`Variant: ${variant}${policy ? ` (policy: ${policy})` : " (active prompts)"}`);
console.log(`Config hash:  ${evidence.config.configHash}`);
console.log(`Coverage hash: ${evidence.config.coverageHash}`);
console.log(`Cost: tokens=${evidence.cost.tokens} latencyMs=${evidence.cost.latencyMs} source=${evidence.cost.source}`);
console.log(`Evidence: ${written.dir}`);
