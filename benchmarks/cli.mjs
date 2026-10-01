#!/usr/bin/env node
/**
 * Unified benchmark CLI — RC1 entrypoint.
 *
 * Dispatcher for the four benchmark suites under a single envelope layout.
 * Every suite emits the same four artifacts into `<outDir>/<suite>/`:
 *
 *   manifest.json   — generatedAt, suite, sha256 of the other 3 artifacts
 *   raw.json        — full raw evidence from the underlying suite
 *   metrics.json    — compact, normalized metric summary
 *   report.md       — human-readable report
 *
 * Usage:
 *   node benchmarks/cli.mjs [--suite=deterministic|validation|real|all] [--out=<dir>]
 *
 * Default: --suite=deterministic
 *
 * Notes:
 *   - `real` runs in dry-run mode (mock provider, no network). Never reaches out.
 *   - `validation` is the deterministic validation suite (no network).
 *   - `deterministic` is the legacy trace-replay suite (no network).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";

import { runBenchmarkSuite } from "./run.mjs";
import { runValidationSuite } from "./run-validation.mjs";
import { runDryRun } from "./run-real.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SUITES = Object.freeze(["deterministic", "validation", "real"]);

export function parseArgs(argv) {
  const args = { suite: "deterministic", out: null };
  for (const tok of argv.slice(2)) {
    if (tok.startsWith("--suite=")) {
      args.suite = tok.slice("--suite=".length).trim();
    } else if (tok.startsWith("--out=")) {
      args.out = tok.slice("--out=".length).trim();
    } else if (tok === "--help" || tok === "-h") {
      args.help = true;
    }
  }
  if (!SUITES.includes(args.suite) && args.suite !== "all") {
    throw new Error(
      `Unknown suite: ${args.suite}. Allowed: ${SUITES.join(", ")}, all`
    );
  }
  if (args.out) args.out = path.resolve(args.out);
  return args;
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Normalize the raw output of each suite into the uniform envelope layout.
 * Each adapter returns { raw, metrics, markdown } given the outDir already
 * populated by the underlying suite.
 */
function readDeterministicArtifacts(outDir) {
  // run.mjs writes raw.json, summary.json, report.md into outDir.
  const raw = JSON.parse(fs.readFileSync(path.join(outDir, "raw.json"), "utf8"));
  const summary = JSON.parse(
    fs.readFileSync(path.join(outDir, "summary.json"), "utf8")
  );
  const report = fs.readFileSync(path.join(outDir, "report.md"), "utf8");
  const metrics = {
    version: "2.0.0",
    cases: summary.cases ?? summary.results?.length ?? 0,
    totalSavingsPct: summary.totals?.totalSavingsPct ?? null,
    fastPathCount: summary.totals?.fastPathCount ?? null,
  };
  return { raw, metrics, markdown: report };
}

function readValidationArtifacts(outDir) {
  const raw = JSON.parse(fs.readFileSync(path.join(outDir, "raw.json"), "utf8"));
  const report = fs.readFileSync(path.join(outDir, "report.md"), "utf8");
  const totals = raw.causal?.totals ?? {};
  const snapshot = Array.isArray(raw.snapshot) ? raw.snapshot : [];
  const snapshotPass = snapshot.filter((s) => s.pass).length;
  const metrics = {
    validationVersion: raw.validationVersion,
    scenarios: raw.causal?.byScenario?.length ?? 0,
    turns: totals.turns ?? 0,
    contextRebuilds: totals.contextRebuilds ?? 0,
    fastPathCount: totals.fastPathCount ?? 0,
    totalReductionPct: totals.totalReductionPct ?? null,
    snapshotCases: snapshot.length,
    snapshotPassed: snapshotPass,
  };
  return { raw, metrics, markdown: report };
}

function readRealArtifacts(outDir) {
  const rawSuite = JSON.parse(
    fs.readFileSync(path.join(outDir, "summary.json"), "utf8")
  );
  const realReport = JSON.parse(
    fs.readFileSync(path.join(outDir, "real-report.json"), "utf8")
  );
  const metrics = {
    scenarios: Array.isArray(rawSuite.results) ? rawSuite.results.length : 0,
    baselineInputTokens: realReport.metrics?.baseline?.inputTokens ?? null,
    wamInputTokens: realReport.metrics?.wam?.inputTokens ?? null,
    outcomeMatch: realReport.evaluations
      ? realReport.evaluations.filter((e) => e.outcomeMatch !== false).length
      : null,
    invalidComparisons: (realReport.evaluations || []).filter(
      (e) => e.invalidComparison
    ).length,
  };
  return { raw: { suite: rawSuite, realReport }, metrics, markdown: null };
}

function writeEnvelope(suite, targetDir, { raw, metrics, markdown }) {
  fs.mkdirSync(targetDir, { recursive: true });

  const rawPath = path.join(targetDir, "raw.json");
  const metricsPath = path.join(targetDir, "metrics.json");
  const reportPath = path.join(targetDir, "report.md");
  const manifestPath = path.join(targetDir, "manifest.json");

  fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`);
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  if (markdown == null) {
    const md =
      `# ${suite} (dry-run)\n\n` +
      `This suite produces no narrative report — see raw.json + metrics.json.\n\n` +
      `Generated by benchmarks/cli.mjs runSuite().\n`;
    fs.writeFileSync(reportPath, md);
  } else {
    fs.writeFileSync(reportPath, markdown);
  }

  const artifacts = [
    { path: "raw.json", bytes: fs.statSync(rawPath).size, sha256: sha256(fs.readFileSync(rawPath)) },
    {
      path: "metrics.json",
      bytes: fs.statSync(metricsPath).size,
      sha256: sha256(fs.readFileSync(metricsPath)),
    },
    {
      path: "report.md",
      bytes: fs.statSync(reportPath).size,
      sha256: sha256(fs.readFileSync(reportPath)),
    },
  ];

  const manifest = {
    schema: "rc1-cli-envelope@1",
    suite,
    generatedAt: new Date().toISOString(),
    repoCommit: "unknown",
    artifacts,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, artifacts };
}

/**
 * Run a single suite by name and emit the uniform envelope.
 *
 * @param {"deterministic"|"validation"|"real"} name
 * @param {{outDir?: string, baseDir?: string}} [opts]
 * @returns {Promise<{suite:string, outDir:string, manifest:object}>}
 */
export async function runSuite(name, opts = {}) {
  if (!SUITES.includes(name)) {
    throw new Error(`Unknown suite: ${name}. Allowed: ${SUITES.join(", ")}`);
  }
  const baseOut =
    opts.outDir ||
    path.join(__dirname, "results", `cli-${name}-${Date.now()}`);
  const target = path.join(baseOut, name);
  fs.mkdirSync(target, { recursive: true });

  if (name === "deterministic") {
    // run.mjs only writes artifacts on direct invocation, so the CLI reproduces
    // the same file set from the library entry (runBenchmarkSuite) and then
    // re-emits it through the uniform envelope.
    const workDir = path.join(baseOut, "_det-work");
    const detOut = path.join(workDir, new Date().toISOString().replace(/:/g, "-"));
    fs.mkdirSync(detOut, { recursive: true });
    const chartsDir = path.join(detOut, "charts");
    fs.mkdirSync(chartsDir, { recursive: true });

    const suite = runBenchmarkSuite();
    const { buildRawEvidence, buildSummary, buildReport } = await import(
      "./reporters/json-reporter.mjs"
    );
    const {
      tokenConsumptionSvg,
      contextConsumptionSvg,
      savingsDistributionSvg,
      verifiedProgressSvg,
    } = await import("./charts/charts.mjs");
    const summary = buildSummary(suite);

    fs.writeFileSync(path.join(detOut, "raw.json"), JSON.stringify(buildRawEvidence(suite), null, 2));
    fs.writeFileSync(path.join(detOut, "summary.json"), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(detOut, "report.md"), buildReport(suite, summary));
    fs.writeFileSync(path.join(chartsDir, "token-consumption.svg"), tokenConsumptionSvg(suite));
    fs.writeFileSync(
      path.join(chartsDir, "context-consumption.svg"),
      contextConsumptionSvg(suite)
    );
    fs.writeFileSync(
      path.join(chartsDir, "savings-distribution.svg"),
      savingsDistributionSvg(suite.results.map((r) => r.savings.inputSavingsPct))
    );
    fs.writeFileSync(
      path.join(chartsDir, "verified-progress.svg"),
      verifiedProgressSvg(suite)
    );

    const { raw, metrics, markdown } = readDeterministicArtifacts(detOut);
    const { manifest } = writeEnvelope(name, target, { raw, metrics, markdown });
    fs.rmSync(workDir, { recursive: true, force: true });
    return { suite: name, outDir: target, manifest };
  }

  if (name === "validation") {
    const workDir = path.join(baseOut, "_val-work");
    fs.mkdirSync(workDir, { recursive: true });
    await runValidationSuite({ outDir: workDir, baseDir: opts.baseDir });
    const { raw, metrics, markdown } = readValidationArtifacts(workDir);
    const { manifest } = writeEnvelope(name, target, { raw, metrics, markdown });
    fs.rmSync(workDir, { recursive: true, force: true });
    return { suite: name, outDir: target, manifest };
  }

  if (name === "real") {
    // dry-run only — never reaches the network. runDryRun writes summary.json,
    // real-report.json and manifest.json into `target`; the envelope then
    // rewrites manifest.json with the uniform envelope schema.
    await runDryRun({ outDir: target });
    const { raw, metrics } = readRealArtifacts(target);
    const { manifest } = writeEnvelope(name, target, { raw, metrics, markdown: null });
    return { suite: name, outDir: target, manifest };
  }

  throw new Error(`Unknown suite: ${name}`);
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      "Usage: node benchmarks/cli.mjs [--suite=deterministic|validation|real|all] [--out=<dir>]"
    );
    return 0;
  }
  const baseOut =
    args.out || path.join(__dirname, "results", `cli-${Date.now()}`);
  fs.mkdirSync(baseOut, { recursive: true });

  const targets = args.suite === "all" ? SUITES : [args.suite];
  for (const name of targets) {
    const r = await runSuite(name, { outDir: baseOut });
    console.log(`[cli] ${name} → ${r.outDir}`);
  }
  console.log(`[cli] all artifacts under ${baseOut}`);
  return 0;
}

// Direct invocation
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.stack || err.message);
      process.exit(1);
    }
  );
}
