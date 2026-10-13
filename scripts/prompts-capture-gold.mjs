#!/usr/bin/env node
/**
 * GOLD CAPTURE CLI.
 *
 * Runs the BASELINE arm (ACTIVE policy, resolved exactly like
 * `scripts/prompts-live.mjs`) against a provider via the shared
 * `runLiveVariant`, and freezes the raw outputs as an immutable fixture:
 *
 *   <out>/raw/<suite>.json  { suite, model, temperature: 0, outputs, usage }
 *   <out>/meta.json         { schema, version, provenance, model, temperature: 0 }
 *
 * Labels (`labels.json`) are authored separately (PROVISIONAL single
 * annotator) and are NOT produced here.
 *
 * Usage:
 *   node scripts/prompts-capture-gold.mjs [--suite all|verify|scope|simplify|delegation] \
 *     [--out <dir>] [--dry-run] [--force]
 *   node scripts/prompts-capture-gold.mjs --help
 *
 * Defaults: suite=all, out=benchmarks/quality/prompt-eval/gold/v1-provisional.
 * `--dry-run` selects the mock provider (no network).
 *
 * Safety: the canonical gold dir is a FROZEN calibration fixture. Capturing
 * refuses to overwrite an existing fixture (meta.json and/or raw/) unless
 * `--force` is passed. A mock/dry-run capture into the canonical dir is
 * likewise refused without `--force`; route dry-run output to a non-canonical
 * `--out` instead.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveProvider } from "../benchmarks/providers/index.mjs";
import { listSuites } from "../benchmarks/quality/prompt-eval/freeze-baseline.mjs";
import { runLiveVariant } from "../benchmarks/quality/prompt-eval/live.mjs";
import { GOLD_SCHEMA, GOLD_VERSION } from "../benchmarks/quality/prompt-eval/calibrate.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const EVAL_DIR = path.join(ROOT, "benchmarks", "quality", "prompt-eval");
const DEFAULT_OUT = path.join(EVAL_DIR, "gold", GOLD_VERSION);
const PROVENANCE = "agent-authored single-annotator (PROVISIONAL)";

/** Prompt ref → active (shipped) policy file (mirrors prompts-live.mjs). */
const ACTIVE_BY_REF = Object.freeze({
  "policy.verify.rules": "prompts/policies/verify.md",
  "policy.scope.rules": "prompts/policies/scope.md",
  "policy.simplify.rules": "prompts/policies/simplify.md",
  "injection.delegation": "prompts/injections/delegation.md",
});

export const USAGE = [
  "Usage: node scripts/prompts-capture-gold.mjs [options]",
  "",
  "Captures the baseline arm against a provider and freezes the raw outputs as",
  "an immutable gold fixture. The canonical target is FROZEN: overwriting an",
  "existing fixture requires --force.",
  "",
  "Options:",
  "  --suite <all|verify|scope|simplify|delegation>  Suite to capture (default: all)",
  "  --out <dir>        Output directory (default: gold/<version>)",
  "  --dry-run          Use the mock provider (no network)",
  "  --force            Allow overwriting an existing/frozen gold fixture",
  "  -h, --help         Print this usage and exit",
].join("\n");

export function parseArgs(argv) {
  const result = { suite: "all", dryRun: false, force: false, help: false, unknown: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const valueOf = () => (arg.includes("=") ? arg.split("=")[1] : argv[++i]);
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--force") result.force = true;
    else if (arg.startsWith("--suite")) result.suite = valueOf();
    else if (arg.startsWith("--out")) result.out = valueOf();
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg.startsWith("-")) result.unknown.push(arg);
  }
  return result;
}

function readPolicy(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`prompt file not found: ${relPath}`);
  }
  return fs.readFileSync(abs, "utf8");
}

function resolveCaptureEnv({ dryRun }) {
  const env = { ...process.env };
  if (dryRun) {
    env.WAM_BENCH_MODE = "dry-run";
    delete env.WAM_BENCH_BASE_URL;
  }
  return env;
}

/** Mirrors resolveProvider's dry-run detection (benchmarks/providers/index.mjs). */
function isMockEnv(env) {
  return (
    env.WAM_BENCH_MODE === "dry-run" ||
    (!env.WAM_BENCH_BASE_URL && env.WAM_BENCH_REAL_MODEL !== "1")
  );
}

/** True when `dir` already holds a frozen gold fixture. */
export function hasFrozenFixture(dir) {
  return fs.existsSync(path.join(dir, "meta.json")) || fs.existsSync(path.join(dir, "raw"));
}

/**
 * Capture baseline raw outputs and freeze them.
 *
 * @param {{ suites?: object[], outDir?: string, provider?: object,
 *   temperature?: number, version?: string }} [options]
 * @returns {Promise<{ written: string[], suites: string[], model: string }>}
 */
export async function captureGold({
  suites,
  outDir,
  provider,
  temperature = 0,
  version = GOLD_VERSION,
} = {}) {
  if (!provider || typeof provider.complete !== "function") {
    throw new TypeError("captureGold: requires a provider with complete()");
  }
  const target = outDir ? path.resolve(outDir) : DEFAULT_OUT;
  const suiteList = suites ?? listSuites();
  fs.mkdirSync(path.join(target, "raw"), { recursive: true });

  const written = [];
  for (const suite of suiteList) {
    const promptRef = suite.scenarios?.[0]?.promptRef ?? suite.promptRef;
    const activeRel = ACTIVE_BY_REF[promptRef];
    if (!activeRel) {
      throw new Error(`no active policy mapped for promptRef "${promptRef}" (suite ${suite.id})`);
    }
    const policyText = readPolicy(activeRel);
    const live = await runLiveVariant({
      suite,
      variantId: "baseline",
      policyText,
      provider,
      temperature,
    });
    const rawPath = path.join(target, "raw", `${suite.id}.json`);
    const record = {
      suite: suite.id,
      model: live.cost?.model ?? provider.model,
      temperature,
      outputs: live.outputs,
      usage: {
        tokens: live.cost?.tokens ?? null,
        latencyMs: live.cost?.latencyMs ?? null,
        executionFailures: live.cost?.executionFailures ?? 0,
      },
    };
    fs.writeFileSync(rawPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    written.push(rawPath);
  }

  const meta = {
    schema: GOLD_SCHEMA,
    version,
    provenance: PROVENANCE,
    model: provider.model,
    temperature,
  };
  const metaPath = path.join(target, "meta.json");
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  written.push(metaPath);

  return { written, suites: suiteList.map((s) => s.id), model: provider.model };
}

async function main(argv) {
  const args = parseArgs(argv);

  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.unknown.length > 0) {
    console.error(`Unknown option(s): ${args.unknown.join(", ")}\n`);
    console.error(USAGE);
    process.exit(2);
  }

  const all = listSuites();
  const selected = args.suite === "all" ? all : all.filter((s) => s.id === args.suite);
  if (selected.length === 0) {
    console.error(`Suite not found: ${args.suite}`);
    process.exit(1);
  }

  const target = args.out ? path.resolve(args.out) : DEFAULT_OUT;
  const env = resolveCaptureEnv({ dryRun: args.dryRun });
  const isMock = isMockEnv(env);

  if (!args.force) {
    if (hasFrozenFixture(target)) {
      console.error(
        `Refusing to overwrite frozen gold fixture at ${path.relative(ROOT, target)}.\n` +
          "Pass --force only if you intend to replace the calibration ground truth.",
      );
      process.exit(1);
    }
    if (isMock && target === DEFAULT_OUT) {
      console.error(
        "Refusing to capture mock/dry-run outputs into the canonical gold dir " +
          `(${path.relative(ROOT, target)}).\n` +
          "Send dry-run output to a non-canonical --out, or pass --force.",
      );
      process.exit(1);
    }
  }

  const provider = resolveProvider({ env });
  const { written, model } = await captureGold({
    suites: selected,
    outDir: args.out,
    provider,
  });
  console.log(
    `Captured baseline gold (${isMock ? "dry-run/mock" : "live"}, model=${model}):`,
  );
  for (const file of written) console.log(` - ${path.relative(ROOT, file)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
