import { summarizeRepeated } from "../analyzers/analyzer.mjs";
import { classify, CLAIM_LEVELS } from "./claims.mjs";

export function buildRawEvidence(suite) {
  return suite;
}

export function buildSummary(suite, timestamp = new Date().toISOString()) {
  return { ...suite, timestamp, statistics: summarizeRepeated(suite.results) };
}

function pct(v) {
  return `${v > 0 ? "+" : ""}${v}%`;
}

export function buildReport(suite, summary) {
  const statistics = summary.statistics || summarizeRepeated(suite.results);
  const lines = [];
  lines.push(`# Benchmark Report — ${suite.benchmark}`);
  lines.push("");
  lines.push("## Methodology");
  lines.push("");
  lines.push("Deterministic trace replay of captured execution traces. Token counts are");
  lines.push("derived from recorded per-turn measurements, not from scenario constants.");
  lines.push("Baseline and WAM traces represent equivalent tasks; the only intended");
  lines.push("difference is the presence or absence of WAM. Negative savings are valid.");
  lines.push("");
  lines.push("## Claims Policy");
  lines.push("");
  lines.push("Every measurement is classified as one of:");
  lines.push("");
  lines.push("- `observed` — reported directly by the provider or execution trace");
  lines.push("- `measured` — calculated from captured execution data");
  lines.push("- `derived` — calculated from measured values");
  lines.push("- `estimated` — inferred using a declared estimator");
  lines.push("");
  lines.push(`Claim levels: ${CLAIM_LEVELS.join(", ")}`);
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(`- Benchmark version: ${suite.version}`);
  lines.push(`- Mode: ${suite.mode}`);
  lines.push(`- Git SHA: ${suite.provenance.gitSha}`);
  lines.push(`- Dirty tree: ${suite.provenance.dirty}`);
  lines.push(`- Timestamp: ${suite.timestamp || summary.timestamp}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push("| Scenario | Condition | Claim | Input | Output | Total | Turns | Rebuilds | Verified Progress | Completion |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of suite.results) {
    for (const cond of ["baseline", "wam"]) {
      const m = r[cond];
      lines.push(
        `| ${r.scenarioId} | ${cond} | ${classify(m.tokenSource)} | ${m.inputTokens} | ${m.outputTokens} | ${m.totalTokens} | ${m.turns} | ${m.contextRebuilds} | ${m.verifiedProgress} | ${m.completionStatus} |`
      );
    }
  }
  lines.push("");
  lines.push("## Savings");
  lines.push("");
  lines.push("| Scenario | Input Δ | Input Savings | Total Δ | Total Savings |");
  lines.push("|---|---|---|---|---|");
  for (const r of suite.results) {
    lines.push(
      `| ${r.scenarioId} | ${r.savings.inputTokens} | ${pct(r.savings.inputSavingsPct)} | ${r.savings.totalTokens} | ${pct(r.savings.totalSavingsPct)} |`
    );
  }
  lines.push("");
  lines.push("## Statistics (input savings %)");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  const s = statistics.inputSavingsPct || {};
  for (const k of ["n", "min", "p25", "median", "p75", "max"]) {
    lines.push(`| ${k} | ${s[k]} |`);
  }
  lines.push("");
  return lines.join("\n");
}
