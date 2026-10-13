#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareRuns } from "../benchmarks/quality/prompt-eval/compare.mjs";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--baseline")) {
      result.baseline = arg.includes("=") ? arg.split("=")[1] : args[++i];
    } else if (arg.startsWith("--candidate")) {
      result.candidate = arg.includes("=") ? arg.split("=")[1] : args[++i];
    }
  }
  return result;
}

const args = process.argv.slice(2);
const { baseline: baselineId, candidate: candidateId } = parseArgs(args);

if (!baselineId || !candidateId) {
  console.error("Usage: node scripts/prompts-compare.mjs --baseline <run-id> --candidate <run-id>");
  process.exit(1);
}

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

const baselinePath = path.join(root, "benchmarks/quality/prompt-eval/runs", baselineId, "run.json");
const candidatePath = path.join(root, "benchmarks/quality/prompt-eval/runs", candidateId, "run.json");

if (!fs.existsSync(baselinePath)) {
  console.error(`Baseline run not found: ${baselinePath}`);
  process.exit(1);
}
if (!fs.existsSync(candidatePath)) {
  console.error(`Candidate run not found: ${candidatePath}`);
  process.exit(1);
}

const baselineRun = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const candidateRun = JSON.parse(fs.readFileSync(candidatePath, "utf8"));

try {
  const result = compareRuns(baselineRun, candidateRun);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error(`Comparison failed: ${error.message}`);
  process.exit(1);
}
