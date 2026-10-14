#!/usr/bin/env node
/**
 * CALIBRATION CLI.
 *
 * Loads the frozen gold fixture (labels), recomputes the deterministic oracle
 * verdicts over the frozen raw outputs, computes Cohen's κ (per-criterion,
 * per-suite, overall) against the gold labels, writes a deterministic
 * `calibration.json`, prints a per-suite table and fails the gate (non-zero
 * exit) when thresholds are not met.
 *
 * Usage:
 *   node scripts/prompts-calibrate.mjs [--gold <dir|version>] [--out <path>] [--json]
 *   node scripts/prompts-calibrate.mjs --help
 *
 * Defaults: gold=benchmarks/quality/prompt-eval/gold/v1-provisional,
 * out=benchmarks/quality/prompt-eval/calibration.json.
 *
 * A missing labels file is reported as a gate reason, never a crash.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { listSuites } from "../benchmarks/quality/prompt-eval/freeze-baseline.mjs";
import {
  calibrate,
  collectOracleVerdicts,
  loadGold,
  serializeCalibration,
  GOLD_VERSION,
} from "../benchmarks/quality/prompt-eval/calibrate.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const EVAL_DIR = path.join(ROOT, "benchmarks", "quality", "prompt-eval");
const DEFAULT_GOLD = path.join(EVAL_DIR, "gold", GOLD_VERSION);
const DEFAULT_OUT = path.join(EVAL_DIR, "calibration.json");

export const USAGE = [
  "Usage: node scripts/prompts-calibrate.mjs [options]",
  "",
  "Loads the frozen gold fixture (labels), recomputes the deterministic",
  "oracle verdicts over the frozen raw outputs, computes Cohen's kappa",
  "and writes the deterministic calibration report.",
  "",
  "Options:",
  "  --gold <dir|version>  Gold fixture dir or version (default: gold/<version>)",
  "  --out <path>          Output report path (default: calibration.json)",
  "  --json                Print the calibration report as JSON",
  "  -h, --help            Print this usage and exit (no calibration, no writes)",
].join("\n");

export function parseArgs(argv) {
  const result = { json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const valueOf = () => (arg.includes("=") ? arg.split("=")[1] : argv[++i]);
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg.startsWith("--gold")) result.gold = valueOf();
    else if (arg.startsWith("--out")) result.out = valueOf();
    else if (arg === "--json") result.json = true;
  }
  return result;
}

/** `--gold` may be a version name or a path. */
export function resolveGoldDir(gold) {
  if (!gold) return DEFAULT_GOLD;
  const asPath = path.resolve(gold);
  if (fs.existsSync(asPath)) return asPath;
  return path.join(EVAL_DIR, "gold", gold);
}

function loadRawOutputs(goldDir, suites) {
  const outputs = {};
  const missing = [];
  for (const suite of suites) {
    const rawPath = path.join(goldDir, "raw", `${suite.id}.json`);
    if (!fs.existsSync(rawPath)) {
      missing.push(suite.id);
      outputs[suite.id] = {};
      continue;
    }
    try {
      const record = JSON.parse(fs.readFileSync(rawPath, "utf8"));
      outputs[suite.id] = record?.outputs ?? {};
    } catch (err) {
      missing.push(`${suite.id} (invalid JSON: ${err.message})`);
      outputs[suite.id] = {};
    }
  }
  return { outputs, missing };
}

function fmt(value) {
  return value == null ? "  null" : value.toFixed(3).padStart(6);
}

function printTable(cal) {
  const header = ["suite", "n", "kappa", "f1", "gate"].join("\t");
  console.log(header);
  console.log("-".repeat(header.length + 8));
  for (const s of cal.suites) {
    console.log(
      [s.suite, String(s.n), fmt(s.kappa), fmt(s.f1), s.criteria.length ? "" : "no criteria"].join("\t"),
    );
  }
  console.log(
    ["OVERALL", String(cal.overall.n), fmt(cal.overall.kappa), fmt(cal.overall.f1), cal.gate.status].join("\t"),
  );
}

export function runCalibration({ gold, out } = {}) {
  const goldDir = resolveGoldDir(gold);
  const outPath = out ? path.resolve(out) : DEFAULT_OUT;
  const allSuites = listSuites();

  const goldSet = loadGold(goldDir);
  const suites = allSuites.filter((s) => goldSet.labels[s.id]);
  const { outputs, missing } = loadRawOutputs(goldDir, suites);
  const oracleVerdicts = collectOracleVerdicts({ suites, outputs });

  const cal = calibrate({ suites, gold: goldSet, oracleVerdicts });

  const gateReasons = [...cal.gate.reasons];
  for (const error of goldSet.errors) gateReasons.push(`gold: ${error}`);
  for (const suiteId of missing) gateReasons.push(`gold: raw/${suiteId}.json missing`);
  if (gateReasons.length > 0) {
    cal.gate = { status: "fail", reasons: gateReasons };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, serializeCalibration(cal), "utf8");

  return { cal, outPath, goldDir };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const { cal, outPath, goldDir } = runCalibration({ gold: args.gold, out: args.out });

  if (args.json) {
    process.stdout.write(serializeCalibration(cal));
  } else {
    console.log(`gold: ${path.relative(ROOT, goldDir)}`);
    printTable(cal);
    if (cal.gate.status !== "pass") {
      console.log("\nGATE FAIL:");
      for (const reason of cal.gate.reasons) console.log(` - ${reason}`);
    } else {
      console.log("\nGATE PASS");
    }
    console.log(`\nwrote ${path.relative(ROOT, outPath)}`);
  }

  process.exit(cal.gate.status === "pass" ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
