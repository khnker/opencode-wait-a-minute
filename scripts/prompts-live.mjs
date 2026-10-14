#!/usr/bin/env node
/**
 * LIVE prompt-policy experiment CLI.
 *
 * Runs the ACTIVE policy and the matching EXPERIMENTAL variant against a real
 * LLM, grades both with the deterministic oracles, writes experiment evidence
 * and a summary, and flags a VETO when the variant regresses (cost never
 * offsets a regression).
 *
 * Usage:
 *   node scripts/prompts-live.mjs [--suite verify|scope|simplify|delegation|discovery|runtime|decision-gate|completion|all] \
 *     [--variant V1|S1|P1|D1|D5|R1|G1|C1] [--out <dir>] [--dry-run] [--trials N] [--temperature <t>]
 *
 * Defaults: suite=all, out=benchmarks/results/live-<iso>, trials=1, temperature=0.
 * `--dry-run` uses the mock provider (no network); live output dirs are
 * gitignored and never committed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProvider } from "../benchmarks/providers/index.mjs";
import { listSuites } from "../benchmarks/quality/prompt-eval/freeze-baseline.mjs";
import {
  runExperiment,
  writeExperiment,
  compareExperiments,
} from "../benchmarks/quality/prompt-eval/experiment.mjs";
import { runLiveVariant } from "../benchmarks/quality/prompt-eval/live.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

/** Prompt ref → active (shipped) policy file. */
const ACTIVE_BY_REF = Object.freeze({
  "policy.verify.rules": "prompts/policies/verify.md",
  "policy.scope.rules": "prompts/policies/scope.md",
  "policy.simplify.rules": "prompts/policies/simplify.md",
  "injection.delegation": "prompts/injections/delegation.md",
  "policy.discovery.rules": "prompts/policies/discovery.md",
  "policy.runtime.rules": "prompts/policies/runtime.md",
  "policy.decision-gate.rules": "prompts/policies/decision-gate.md",
  "policy.completion.rules": "prompts/policies/completion.md",
});

/** Suite → default experimental variant + its experiment file. */
const VARIANT_BY_SUITE = Object.freeze({
  verify: "V1",
  scope: "S1",
  simplify: "P1",
  delegation: "D1",
  discovery: "D5",
  runtime: "R1",
  "decision-gate": "G1",
  completion: "C1",
});

const VARIANT_POLICY = Object.freeze({
  V1: "verify",
  S1: "scope",
  P1: "simplify",
  D1: "delegation",
  D5: "discovery",
  R1: "runtime",
  G1: "decision-gate",
  C1: "completion",
});

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const valueOf = () => (arg.includes("=") ? arg.split("=")[1] : args[++i]);
    if (arg.startsWith("--suite")) result.suite = valueOf();
    else if (arg.startsWith("--variant")) result.variant = valueOf();
    else if (arg.startsWith("--out")) result.out = valueOf();
    else if (arg.startsWith("--trials")) result.trials = Number(valueOf());
    else if (arg.startsWith("--temperature")) result.temperature = Number(valueOf());
    else if (arg === "--dry-run") result.dryRun = true;
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
const suiteName = args.suite ?? "all";
const dryRun = args.dryRun === true;
const trials = Number.isFinite(args.trials) && args.trials > 0 ? args.trials : 1;
const temperature = Number.isFinite(args.temperature) ? args.temperature : 0;

const outDir = args.out
  ? path.resolve(args.out)
  : path.join(ROOT, "benchmarks", "results", `live-${new Date().toISOString().replace(/[:.]/g, "-")}`);

function readPolicy(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`prompt file not found: ${relPath}`);
  }
  return fs.readFileSync(abs, "utf8");
}

function passRateOf(evidence) {
  const details = evidence?.run?.labels?.[0]?.details ?? [];
  if (details.length === 0) return null;
  const passed = details.filter((d) => d.passed && d.evaluable !== false).length;
  return passed / details.length;
}

function fmtRate(rate) {
  return rate == null ? "n/a" : `${(rate * 100).toFixed(0)}%`;
}

const allSuites = listSuites();
const selectedSuites = suiteName === "all" ? allSuites : allSuites.filter((s) => s.id === suiteName);
if (selectedSuites.length === 0) {
  console.error(`Suite not found: ${suiteName}`);
  process.exit(1);
}

const env = { ...process.env };
if (dryRun) {
  env.WAM_BENCH_MODE = "dry-run";
  delete env.WAM_BENCH_BASE_URL;
}
const provider = resolveProvider({ env });

const summary = {
  schema: "wam.prompt-eval.live-summary/1",
  dryRun,
  trials,
  temperature,
  maxTokens: 1024,
  model: provider.model,
  suites: [],
};

for (const suite of selectedSuites) {
  const promptRef = suite.scenarios[0]?.promptRef;
  const activeRel = ACTIVE_BY_REF[promptRef];
  if (!activeRel) {
    throw new Error(`no active policy mapped for promptRef "${promptRef}" (suite ${suite.id})`);
  }

  const variantId = args.variant ?? VARIANT_BY_SUITE[suite.id];
  const policyFolder = VARIANT_POLICY[variantId];
  if (!policyFolder) {
    throw new Error(`unknown variant "${variantId}" (expected V1|S1|P1|D1|D5|R1|G1|C1)`);
  }
  const variantRel = `prompts/experiments/${policyFolder}/${variantId}.md`;

  const activeText = readPolicy(activeRel);
  const variantText = readPolicy(variantRel);
  const promptContents = { [promptRef]: activeText };

  const baselineLive = await runLiveVariant({
    suite,
    variantId,
    policyText: activeText,
    provider,
    temperature,
    trials,
  });
  const variantLive = await runLiveVariant({
    suite,
    variantId,
    policyText: variantText,
    provider,
    temperature,
    trials,
  });

  const baselineEvidence = runExperiment({
    suiteId: suite.id,
    variant: "baseline",
    promptContents,
    outputs: baselineLive.outputs,
    suites: [suite],
    cost: {
      tokens: baselineLive.cost.tokens,
      latencyMs: baselineLive.cost.latencyMs,
      executionFailures: baselineLive.cost.executionFailures,
    },
  });
  const variantEvidence = runExperiment({
    suiteId: suite.id,
    variant: variantId,
    promptContents: { [promptRef]: variantText },
    outputs: variantLive.outputs,
    suites: [suite],
    cost: {
      tokens: variantLive.cost.tokens,
      latencyMs: variantLive.cost.latencyMs,
      executionFailures: variantLive.cost.executionFailures,
    },
  });

  const experimentsDir = path.join(outDir, "experiments");
  writeExperiment(baselineEvidence, experimentsDir);
  writeExperiment(variantEvidence, experimentsDir);

  const comparison = compareExperiments(baselineEvidence, variantEvidence);
  const decision = comparison?.decision?.decision ?? "INCONCLUSIVE";
  const regression = decision === "REGRESSION";

  const row = {
    suite: suite.id,
    variant: variantId,
    promptRef,
    experimentIds: {
      baseline: baselineEvidence.experimentId,
      candidate: variantEvidence.experimentId,
    },
    passRate: {
      baseline: passRateOf(baselineEvidence),
      candidate: passRateOf(variantEvidence),
    },
    tokens: {
      baseline: baselineLive.cost.tokens,
      candidate: variantLive.cost.tokens,
    },
    latencyMs: {
      baseline: baselineLive.cost.latencyMs,
      candidate: variantLive.cost.latencyMs,
    },
    executionFailures: {
      baseline: baselineLive.cost.executionFailures,
      candidate: variantLive.cost.executionFailures,
    },
    toolCalls: {
      baseline: baselineLive.cost.toolCallTotals?.calls ?? 0,
      candidate: variantLive.cost.toolCallTotals?.calls ?? 0,
    },
    toolCallsByName: {
      baseline: { ...(baselineLive.cost.toolCallTotals?.byName ?? {}) },
      candidate: { ...(variantLive.cost.toolCallTotals?.byName ?? {}) },
    },
    retries: {
      baseline: (baselineLive.cost.retries ?? []).length,
      candidate: (variantLive.cost.retries ?? []).length,
    },
    decision,
    regression,
    vetoed: regression, // cost never offsets a regression
  };
  summary.suites.push(row);

  console.log(
    [
      suite.id.padEnd(14),
      variantId.padEnd(4),
      `${fmtRate(row.passRate.baseline)}->${fmtRate(row.passRate.candidate)}`.padEnd(11),
      `in ${row.tokens.baseline.input}->${row.tokens.candidate.input}`.padEnd(16),
      `out ${row.tokens.baseline.output}->${row.tokens.candidate.output}`.padEnd(17),
      `lat ${row.latencyMs.baseline.mean.toFixed(1)}->${row.latencyMs.candidate.mean.toFixed(1)}`.padEnd(20),
      `tc ${row.toolCalls.baseline}->${row.toolCalls.candidate}`.padEnd(10),
      `re ${row.retries.baseline}->${row.retries.candidate}`.padEnd(10),
      regression ? "REGRESSION/VETO" : decision,
    ].join(" "),
  );
}

fs.mkdirSync(outDir, { recursive: true });
const summaryPath = path.join(outDir, "live-summary.json");
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(`\nwrote ${summaryPath}`);

const COMPARISON_SCHEMA = "wam.prompt-eval.comparison/1";

function delta(baseline, candidate) {
  if (baseline == null || candidate == null) return null;
  return candidate - baseline;
}

const improves = summary.suites.filter((r) => r.decision === "IMPROVED");
const regressions = summary.suites.filter((r) => r.decision === "REGRESSION");

const comparisonRows = summary.suites.map((row) => ({
  suite: row.suite,
  variant: row.variant,
  promptRef: row.promptRef,
  decision: row.decision,
  regression: row.regression,
  vetoed: row.vetoed,
  experimentIds: row.experimentIds,
  passRate: {
    baseline: row.passRate.baseline,
    candidate: row.passRate.candidate,
    delta: delta(row.passRate.baseline, row.passRate.candidate),
  },
  tokens: {
    baseline: row.tokens.baseline,
    candidate: row.tokens.candidate,
    delta: {
      input: delta(row.tokens.baseline?.input, row.tokens.candidate?.input),
      output: delta(row.tokens.baseline?.output, row.tokens.candidate?.output),
      total: delta(row.tokens.baseline?.total, row.tokens.candidate?.total),
    },
  },
  latencyMs: {
    baseline: row.latencyMs.baseline,
    candidate: row.latencyMs.candidate,
    delta: {
      mean: delta(row.latencyMs.baseline?.mean, row.latencyMs.candidate?.mean),
      p50: delta(row.latencyMs.baseline?.p50, row.latencyMs.candidate?.p50),
    },
  },
  toolCalls: {
    baseline: row.toolCalls.baseline,
    candidate: row.toolCalls.candidate,
    delta: row.toolCalls.candidate - row.toolCalls.baseline,
    byName: {
      baseline: row.toolCallsByName?.baseline ?? {},
      candidate: row.toolCallsByName?.candidate ?? {},
    },
  },
  retries: {
    baseline: row.retries.baseline,
    candidate: row.retries.candidate,
    delta: row.retries.candidate - row.retries.baseline,
  },
}));

const comparisonReport = {
  schema: COMPARISON_SCHEMA,
  generatedAt: new Date().toISOString(),
  dryRun,
  trials,
  temperature,
  model: provider.model,
  totals: {
    suites: summary.suites.length,
    improves: improves.length,
    regressions: regressions.length,
    vetoed: summary.suites.filter((r) => r.vetoed).length,
  },
  improves: improves.map((r) => r.suite),
  regressions: regressions.map((r) => r.suite),
  rows: comparisonRows,
};

const comparisonPath = path.join(outDir, "comparison.json");
fs.writeFileSync(comparisonPath, `${JSON.stringify(comparisonReport, null, 2)}\n`, "utf8");
console.log(`wrote ${comparisonPath}`);

function fmtNum(n) {
  return n == null ? "n/a" : String(n);
}
function fmtSigned(n) {
  if (n == null) return "n/a";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

const mdLines = [];
mdLines.push(`# Prompt-Eval Comparison Report`);
mdLines.push("");
mdLines.push(`- schema: \`${COMPARISON_SCHEMA}\``);
mdLines.push(`- generatedAt: \`${comparisonReport.generatedAt}\``);
mdLines.push(`- dry-run: \`${dryRun}\``);
mdLines.push(`- trials: \`${trials}\``);
mdLines.push(`- temperature: \`${temperature}\``);
mdLines.push(`- model: \`${provider.model}\``);
mdLines.push("");
mdLines.push(`## Totals`);
mdLines.push("");
mdLines.push(`- suites: \`${comparisonReport.totals.suites}\``);
mdLines.push(`- improves: \`${comparisonReport.totals.improves}\``);
mdLines.push(`- regressions: \`${comparisonReport.totals.regressions}\``);
mdLines.push(`- vetoed: \`${comparisonReport.totals.vetoed}\``);
mdLines.push("");
if (improves.length > 0) {
  mdLines.push(`## Improves`);
  mdLines.push("");
  for (const r of improves) mdLines.push(`- ${r.suite} (variant ${r.variant})`);
  mdLines.push("");
}
if (regressions.length > 0) {
  mdLines.push(`## Regressions`);
  mdLines.push("");
  for (const r of regressions) mdLines.push(`- ${r.suite} (variant ${r.variant})`);
  mdLines.push("");
}
mdLines.push(`## Per-suite comparison`);
mdLines.push("");
mdLines.push("| suite | variant | decision | pass rate | tokens in (b→c) | tokens out (b→c) | latency mean (b→c) | toolCalls (b→c) | retries (b→c) |");
mdLines.push("|---|---|---|---|---|---|---|---|---|");
for (const row of comparisonRows) {
  const pass = `${fmtRate(row.passRate.baseline)} → ${fmtRate(row.passRate.candidate)}`;
  const tIn = `${fmtNum(row.tokens.baseline?.input)} → ${fmtNum(row.tokens.candidate?.input)}`;
  const tOut = `${fmtNum(row.tokens.baseline?.output)} → ${fmtNum(row.tokens.candidate?.output)}`;
  const lat = `${fmtNum(row.latencyMs.baseline?.mean?.toFixed?.(1))} → ${fmtNum(row.latencyMs.candidate?.mean?.toFixed?.(1))}`;
  const tc = `${fmtNum(row.toolCalls.baseline)} → ${fmtNum(row.toolCalls.candidate)} (${fmtSigned(row.toolCalls.delta)})`;
  const re = `${fmtNum(row.retries.baseline)} → ${fmtNum(row.retries.candidate)} (${fmtSigned(row.retries.delta)})`;
  mdLines.push(`| ${row.suite} | ${row.variant} | ${row.decision} | ${pass} | ${tIn} | ${tOut} | ${lat} | ${tc} | ${re} |`);
}
mdLines.push("");
mdLines.push("## toolCalls byName");
mdLines.push("");
for (const row of comparisonRows) {
  const bNames = Object.keys(row.toolCalls.byName.baseline);
  const cNames = Object.keys(row.toolCalls.byName.candidate);
  if (bNames.length === 0 && cNames.length === 0) continue;
  mdLines.push(`### ${row.suite} (${row.variant})`);
  const all = new Set([...bNames, ...cNames]);
  for (const name of [...all].sort()) {
    const b = row.toolCalls.byName.baseline[name] ?? 0;
    const c = row.toolCalls.byName.candidate[name] ?? 0;
    mdLines.push(`- ${name}: ${b} → ${c}`);
  }
  mdLines.push("");
}

const comparisonMdPath = path.join(outDir, "comparison.md");
fs.writeFileSync(comparisonMdPath, `${mdLines.join("\n")}\n`, "utf8");
console.log(`wrote ${comparisonMdPath}`);
