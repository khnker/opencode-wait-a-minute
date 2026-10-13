#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFullReport } from "../benchmarks/quality/prompt-eval/report.mjs";

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--run")) {
      result.run = arg.includes("=") ? arg.split("=")[1] : args[++i];
    }
  }
  return result;
}

const args = process.argv.slice(2);
const { run: runId } = parseArgs(args);

if (!runId) {
  console.error("Usage: node scripts/prompts-report.mjs --run <run-id>");
  process.exit(1);
}

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const runPath = path.join(root, "benchmarks/quality/prompt-eval/runs", runId, "run.json");

if (!fs.existsSync(runPath)) {
  console.error(`Run not found: ${runPath}`);
  process.exit(1);
}

const runData = JSON.parse(fs.readFileSync(runPath, "utf8"));
const report = generateFullReport(runData);
console.log(report.markdown);
