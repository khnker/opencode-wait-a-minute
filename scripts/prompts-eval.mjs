#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEvaluation } from "../benchmarks/quality/prompt-eval/run.mjs";
import { loadPrompt } from "../src/prompts/loader.js";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--suite")) {
      result.suite = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--label")) {
      result.label = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--outDir")) {
      result.outDir = arg.includes("=") ? arg.split("=")[1] : args[++i];
    }
  }
  return result;
}

const args = process.argv.slice(2);
const { suite: suiteName, label, outDir } = parseArgs(args);

if (!suiteName || !label) {
  console.error("Usage: node scripts/prompts-eval.mjs --suite <name|core> --label <label> [--outDir <dir>]");
  process.exit(1);
}

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

const suites = [];
if (suiteName === "core") {
  const suitesDir = path.join(root, "benchmarks/quality/prompt-eval/suites");
  const files = fs.readdirSync(suitesDir);
  files.forEach(f => {
    if (f.endsWith(".json")) {
      suites.push(JSON.parse(fs.readFileSync(path.join(suitesDir, f), "utf8")));
    }
  });
} else {
  const suitePath = path.join(root, "benchmarks/quality/prompt-eval/suites", `${suiteName}.json`);
  if (!fs.existsSync(suitePath)) {
    console.error(`Suite not found: ${suitePath}`);
    process.exit(1);
  }
  suites.push(JSON.parse(fs.readFileSync(suitePath, "utf8")));
}

const promptContents = {};
const allPromptRefs = new Set();
suites.forEach(suite => suite.scenarios.forEach(s => allPromptRefs.add(s.promptRef)));

// runEvaluation expects promptContents[label][promptRef] = content
promptContents[label] = {};
for (const ref of allPromptRefs) {
  promptContents[label][ref] = loadPrompt(ref);
}

// Load recorded outputs from fixtures
const outputsByLabel = {};
const outputsDir = path.join(root, "benchmarks/quality/prompt-eval/outputs");
const labelsToLoad = [label]; // Could be extended to all labels if needed

for (const l of labelsToLoad) {
  outputsByLabel[l] = {};
  for (const suite of suites) {
    const fixturePath = path.join(outputsDir, `${l}__${suite.id}.json`);
    if (fs.existsSync(fixturePath)) {
      const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
      Object.assign(outputsByLabel[l], fixture);
    }
  }
}

const { runId } = runEvaluation({
  labels: [label],
  suites,
  promptContents,
  outputsByLabel,
  root,
  ...(outDir ? { outDir: path.resolve(outDir) } : {})
});
console.log(`Run completed: ${runId}`);
