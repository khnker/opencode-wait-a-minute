/**
 * RC1 evidence report generator.
 *
 * Produces a six-artifact bundle:
 *   manifest.json    — sha256 of the other five artifacts
 *   raw.json         — verbatim inputs (validation summary + real report)
 *   metrics.json     — the three separated metric blocks
 *   comparison.json  — internal-vs-empirical comparison, plus explicit
 *                      INVALID_COMPARISON markers where a comparison is invalid
 *   evidence.json    — the external evidence corpus projection
 *   report.md        — human-readable report with three separate sections
 *
 * HARD RULE: the three evidence sections are never merged into one figure.
 *   A) internalDeterministic — WAM validation suite (no external input)
 *   B) empiricalReal        — WAM real-harness evidence (live provider or mock dry-run)
 *   C) externalEvidence     — the curated external corpus (context only)
 *
 * Provider caching numbers are reported only inside (C), with an explicit
 * statement that they are NOT evidence of WAM context reduction.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sha256File } from "./manifest.mjs";
import { loadEvidenceCorpus } from "../evidence/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CACHE_CAVEAT =
  "Provider prompt-caching figures below describe BILLING/THROTTLING behaviour, " +
  "not context reduction: a cached prefix is still read by the model and still " +
  "occupies the context window. They are NOT evidence of WAM context reduction. " +
  "Cached tokens are reported separately and are never merged with, or substituted " +
  "for, WAM's internal metrics.";

/* ------------------------------------------------------------------ *
 * Section A — internal deterministic
 * ------------------------------------------------------------------ */

function buildInternalDeterministic(validationSummary) {
  const vs = validationSummary || {};
  const causal = vs.causal || {};
  const totals = causal.totals || {};
  const snapshot = Array.isArray(vs.snapshot) ? vs.snapshot : [];
  const snapshotPassed = snapshot.filter((s) => s.pass).length;
  const snapshotFailed = snapshot.length - snapshotPassed;

  return {
    origin: "internal-deterministic",
    suite: "benchmarks/run-validation.mjs",
    network: false,
    evidenceKind: "deterministic-simulation",
    snapshotCorrectness: {
      cases: snapshot.length,
      passed: snapshotPassed,
      failed: snapshotFailed,
      allPassed: snapshotFailed === 0 && snapshot.length > 0,
      noFalseValid: typeof vs.noFalseValid === "boolean" ? vs.noFalseValid : null
    },
    fastPath: {
      count: totals.fastPathCount ?? null,
      rate: totals.fastPathRate ?? null,
      rebuildsAvoided: totals.rebuildsAvoided ?? null
    },
    rebuildAvoidance: {
      contextRebuilds: totals.contextRebuilds ?? null,
      fullRebuildCount: totals.fullRebuildCount ?? null,
      partialRebuildCount: totals.partialRebuildCount ?? null
    },
    deterministicAccounting: {
      scenarios: Array.isArray(causal.byScenario) ? causal.byScenario.length : 0,
      turns: totals.turns ?? null,
      totalReductionPct: totals.totalReductionPct ?? null,
      accountingStable: vs.accountingStable ?? null
    },
    raw: vs
  };
}

/* ------------------------------------------------------------------ *
 * Section B — empirical real (dry-run)
 * ------------------------------------------------------------------ */

function buildEmpiricalReal(realReport) {
  const rr = realReport || {};
  const totals = rr.totals || {};
  const runs = Array.isArray(rr.runs) ? rr.runs : [];
  const evaluations = Array.isArray(rr.evaluations) ? rr.evaluations : [];
  const isProviderExecution =
    (rr.provider && rr.provider !== "mock") ||
    rr.evidence?.execution === "provider_execution";

  const totalInputTokens = totals.wamInputTokens ?? null;
  const baselineInputTokens = totals.baselineInputTokens ?? null;

  // Per-run token accounting straight from the paired runs.
  const runTotals = runs.reduce(
    (acc, r) => {
      acc.inputTokens += r.inputTokens ?? 0;
      acc.totalTokens += r.totalTokens ?? 0;
      acc.contextRebuilds += r.contextRebuilds ?? 0;
      return acc;
    },
    { inputTokens: 0, totalTokens: 0, contextRebuilds: 0 }
  );

  const outcomeMatch = evaluations.filter(
    (e) => e.success === true || e.equivalent === true
  ).length;
  const nonEquivalent = evaluations.filter((e) => e.equivalent === false).length;

  // An INVALID_COMPARISON is any run whose baseline/wam pairing cannot be
  // compared: missing token counts, mismatched pairing, or absent evaluation.
  const invalidComparisons = [];
  runs.forEach((r, i) => {
    if (typeof r.inputTokens !== "number" || typeof r.baselineInputTokens !== "number") {
      invalidComparisons.push({
        index: i,
        pairId: r.pairId ?? null,
        reason: "missing token accounting for baseline or wam"
      });
    }
  });
  if (evaluations.length === 0) {
    invalidComparisons.push({ index: -1, pairId: null, reason: "no evaluations recorded" });
  }

  const multiturn = (Array.isArray(rr.perScenario) ? rr.perScenario : Object.values(rr.perScenario || {})).map(
    (s) => ({
      scenario: s.scenario ?? null,
      turns: s.turns ?? null,
      baselineInputTokens: s.baselineInputTokens ?? null,
      wamInputTokens: s.wamInputTokens ?? null,
      contextRebuilds: s.contextRebuilds ?? null,
      netInputSavings: s.netInputSavings ?? null
    })
  );

  return {
    origin: "empirical-real",
    suite: isProviderExecution
      ? "benchmarks/run-real.mjs (live provider)"
      : "benchmarks/run-real.mjs (runDryRun)",
    network: isProviderExecution,
    evidenceKind: rr.evidence?.execution ?? "deterministic_simulation",
    provider: rr.provider ?? "mock",
    model: rr.model ?? null,
    inputTokens: totalInputTokens,
    baselineInputTokens,
    totalTokens: runTotals.totalTokens,
    rebuilds: totals.contextRebuilds ?? runTotals.contextRebuilds,
    outcomeEquivalence: {
      evaluated: evaluations.length,
      outcomeMatch,
      nonEquivalent,
      equivalenceRate: rr.metrics?.EquivalenceRate ?? null,
      stateEquivalent: totals.stateEquivalent ?? null
    },
    multiturn,
    netInputSavings: totals.netInputSavings ?? rr.netInputSavings ?? null,
    INVALID_COMPARISON: invalidComparisons,
    raw: rr
  };
}

/* ------------------------------------------------------------------ *
 * Section C — external evidence
 * ------------------------------------------------------------------ */

function buildExternalEvidence(evidence) {
  const corpus = evidence && Array.isArray(evidence.sources) ? evidence : loadEvidenceCorpus();
  const sources = corpus.sources.map((s) => ({
    id: s.id,
    source: s.source,
    type: s.type,
    date: s.date,
    metric: s.metric,
    population: s.population,
    relevance: s.relevance,
    limitations: s.limitations
  }));

  const providers = sources.filter((s) => s.type === "provider");
  return {
    origin: "external-evidence",
    corpus: corpus.corpus ?? null,
    version: corpus.version ?? null,
    taxonomy: corpus.taxonomy ?? null,
    sourceCount: sources.length,
    counts: {
      provider: providers.length,
      academic: sources.filter((s) => s.type === "academic").length,
      "open-source": sources.filter((s) => s.type === "open-source").length,
      independent: sources.filter((s) => s.type === "independent").length
    },
    cachedTokensReportedSeparately: true,
    cacheCaveat: CACHE_CAVEAT,
    providerSources: providers.map((s) => ({
      id: s.id,
      metric: s.metric,
      note: "cache/cost behaviour only — NOT evidence of WAM context reduction"
    })),
    sources
  };
}

/* ------------------------------------------------------------------ *
 * comparison.json
 * ------------------------------------------------------------------ */

function buildComparison(internal, empirical) {
  const issues = [];
  const notes = [];

  // The deterministic suite and the empirical-real suite are different harnesses
  // over different models. Their absolute numbers are NOT comparable — say so.
  if (internal.origin !== empirical.origin) {
    notes.push(
      "internalDeterministic (validation harness) and empiricalReal " +
        `(${empirical.network ? "live provider" : "dry-run"} harness) ` +
        "are separate experiments. Their absolute values are reported side by side " +
        "for transparency and are NOT a like-for-like comparison."
    );
  }

  const intRed = internal.deterministicAccounting.totalReductionPct;
  const empNet = empirical.netInputSavings;
  if (typeof intRed === "number" && empNet !== null && empNet !== undefined) {
    if (intRed > 0 && empNet < 0) {
      issues.push({
        code: "INVALID_COMPARISON",
        detail:
          `internal deterministic reduction=${intRed}% but ${empirical.network ? "live" : "dry-run"} ` +
          `netInputSavings=${empNet} (negative). The ${empirical.network ? "live provider" : "dry-run mock provider"} ` +
          "shows WAM overhead exceeding baseline context. These do not contradict each other: " +
          "they measure different things on different harnesses. No single net-savings number is claimed."
      });
    }
  }

  if (empirical.INVALID_COMPARISON.length > 0) {
    issues.push({
      code: "INVALID_COMPARISON",
      detail: `${empirical.INVALID_COMPARISON.length} run(s) could not be compared.`,
      runs: empirical.INVALID_COMPARISON
    });
  }

  return {
    schema: "rc1-comparison@1",
    merged: false,
    mergePolicy:
      "The three evidence sections are reported separately. No combined figure is produced.",
    issues,
    notes
  };
}

/* ------------------------------------------------------------------ *
 * report.md
 * ------------------------------------------------------------------ */

function pct(v) {
  return v === null || v === undefined ? "n/a" : `${v}%`;
}

function buildMarkdown(internal, empirical, external, comparison, generatedAt) {
  const L = [];
  L.push("# RC1 Evidence Report");
  L.push("");
  L.push(`Generated: ${generatedAt}`);
  L.push("");
  L.push(
    "This report keeps three kinds of evidence strictly separate. They are **not** " +
      "combined into a single number, and no section's numbers stand in for another's."
  );
  L.push("");

  L.push("## A. Internal Deterministic");
  L.push("");
  L.push(`Source: \`${internal.suite}\` — ${internal.evidenceKind}, no network.`);
  L.push("");
  L.push("### Snapshot correctness");
  const sc = internal.snapshotCorrectness;
  L.push(`- Cases: ${sc.cases}`);
  L.push(`- Passed: ${sc.passed}`);
  L.push(`- Failed: ${sc.failed}`);
  L.push(`- All passed: ${sc.allPassed}`);
  if (sc.noFalseValid !== null) L.push(`- No false-valid assertion: ${sc.noFalseValid}`);
  L.push("");
  L.push("### Fast path");
  L.push(`- Fast-path count: ${internal.fastPath.count}`);
  L.push(`- Fast-path rate: ${pct(internal.fastPath.rate)}`);
  L.push("");
  L.push("### Rebuild avoidance");
  L.push(`- Context rebuilds: ${internal.rebuildAvoidance.contextRebuilds}`);
  L.push(`- Full rebuilds: ${internal.rebuildAvoidance.fullRebuildCount}`);
  L.push(`- Partial rebuilds: ${internal.rebuildAvoidance.partialRebuildCount}`);
  L.push("");
  L.push("### Deterministic accounting");
  L.push(`- Scenarios: ${internal.deterministicAccounting.scenarios}`);
  L.push(`- Turns: ${internal.deterministicAccounting.turns}`);
  L.push(`- Total reduction: ${pct(internal.deterministicAccounting.totalReductionPct)}`);
  L.push("");

  L.push(
    `## B. Empirical Real (${empirical.network ? "live provider" : "dry-run"})`
  );
  L.push("");
  L.push(
    `Source: \`${empirical.suite}\` — provider \`${empirical.provider}\`, model ` +
      `\`${empirical.model}\`, ${empirical.network ? "live network." : "no network."}`
  );
  L.push("");
  L.push(`- Input tokens (WAM): ${empirical.inputTokens}`);
  L.push(`- Input tokens (baseline): ${empirical.baselineInputTokens}`);
  L.push(`- Total tokens: ${empirical.totalTokens}`);
  L.push(`- Rebuilds: ${empirical.rebuilds}`);
  L.push(`- outcomeMatch: ${empirical.outcomeEquivalence.outcomeMatch} / ${empirical.outcomeEquivalence.evaluated}`);
  L.push(`- Non-equivalent: ${empirical.outcomeEquivalence.nonEquivalent}`);
  L.push(`- State equivalent: ${empirical.outcomeEquivalence.stateEquivalent}`);
  L.push(`- Net input savings: ${empirical.netInputSavings}`);
  if (empirical.network) {
    L.push("");
    L.push(
      "> **Live-run caveat:** `outcomeMatch`/`Non-equivalent` compare the exact " +
        "normalized text of two independent stochastic LLM generations (baseline vs WAM). " +
        "For live provider runs these are expected to be ~0 and are NOT a correctness " +
        "signal. The authoritative live signals are `State equivalent`, the deterministic " +
        "internal suite, and `Net input savings`."
    );
  }
  L.push("");
  L.push("### Multi-turn breakdown");
  L.push("");
  L.push("| scenario | turns | baseline input | wam input | rebuilds | net savings |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  for (const m of empirical.multiturn) {
    L.push(
      `| ${m.scenario} | ${m.turns} | ${m.baselineInputTokens} | ${m.wamInputTokens} | ` +
        `${m.contextRebuilds} | ${m.netInputSavings} |`
    );
  }
  L.push("");
  L.push("### INVALID_COMPARISON markers");
  L.push("");
  if (empirical.INVALID_COMPARISON.length === 0) {
    L.push("None.");
  } else {
    for (const m of empirical.INVALID_COMPARISON) {
      L.push(`- \`INVALID_COMPARISON\` pair=${m.pairId ?? m.index}: ${m.reason}`);
    }
  }
  L.push("");

  L.push("## C. External Evidence");
  L.push("");
  L.push(
    `Corpus: \`${external.corpus}\` v${external.version} — ${external.sourceCount} sources.`
  );
  L.push("");
  L.push(
    "These are **mechanism precedents**, not measurements of WAM. They are listed so the " +
      "reader can see the surrounding design space."
  );
  L.push("");
  L.push("> **Cached tokens are reported separately and are not WAM evidence.**");
  L.push(`> ${external.cacheCaveat}`);
  L.push("");
  L.push("| type | count |");
  L.push("| --- | --- |");
  for (const [k, v] of Object.entries(external.counts)) {
    L.push(`| ${k} | ${v} |`);
  }
  L.push("");
  for (const s of external.sources) {
    L.push(`### \`${s.id}\` (${s.type})`);
    L.push("");
    L.push(`- Source: ${s.source}`);
    L.push(`- Date: ${s.date}`);
    L.push(`- Metric: ${s.metric}`);
    L.push(`- Population: ${s.population}`);
    L.push(`- Relevance: ${s.relevance}`);
    L.push(`- Limitations: ${s.limitations}`);
    L.push("");
  }

  L.push("## Comparison notes");
  L.push("");
  if (comparison.notes.length === 0) {
    L.push("None.");
  } else {
    for (const n of comparison.notes) L.push(`- ${n}`);
  }
  L.push("");
  L.push("## Comparison issues");
  L.push("");
  if (comparison.issues.length === 0) {
    L.push("None.");
  } else {
    for (const i of comparison.issues) L.push(`- \`${i.code}\`: ${i.detail}`);
  }
  L.push("");

  return L.join("\n");
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

function defaultOutDir() {
  return path.join(REPO_ROOT, "benchmarks", "reports", "rc1");
}

function readJsonIfExists(p) {
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/**
 * Generate the RC1 evidence report bundle.
 *
 * @param {{outDir?:string, validationSummary?:object, realReport?:object, evidence?:object}} options
 * @returns {{outDir:string, artifacts:string[], internal:object, empirical:object, external:object}}
 */
export function generateRc1Report(options = {}) {
  const outDir = path.resolve(options.outDir || defaultOutDir());
  const generatedAt = options.generatedAt || new Date().toISOString();

  // Resolve inputs: explicit args win, else look for the latest suite envelope.
  let validationSummary = options.validationSummary ?? null;
  let realReport = options.realReport ?? null;

  if (!validationSummary || !realReport) {
    const resultsRoot = path.join(REPO_ROOT, "benchmarks", "results");
    const searchRoot = options.resultsRoot || resultsRoot;
    if (fs.existsSync(searchRoot)) {
      const entries = fs
        .readdirSync(searchRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => {
          const full = path.join(searchRoot, e.name);
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(full).mtimeMs;
          } catch {
            mtimeMs = 0;
          }
          return { name: e.name, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      for (const { name } of entries) {
        const dir = path.join(searchRoot, name);
        if (!validationSummary) {
          const found =
            readJsonIfExists(path.join(dir, "validation", "raw.json")) ??
            readJsonIfExists(path.join(dir, "raw.json"));
          if (found && found.validationVersion) validationSummary = found;
        }
        if (!realReport) {
          const found =
            readJsonIfExists(path.join(dir, "real", "real-report.json")) ??
            readJsonIfExists(path.join(dir, "real-report.json"));
          if (found && found.totals) realReport = found;
        }
        if (validationSummary && realReport) break;
      }
    }
  }

  const evidence = options.evidence ?? loadEvidenceCorpus();

  const internal = buildInternalDeterministic(validationSummary);
  const empirical = buildEmpiricalReal(realReport);
  const external = buildExternalEvidence(evidence);
  const comparison = buildComparison(internal, empirical);

  fs.mkdirSync(outDir, { recursive: true });

  const metrics = {
    schema: "rc1-metrics@1",
    separationPolicy:
      "Three evidence classes are reported independently; no merged figure is produced.",
    internalDeterministic: {
      snapshotCases: internal.snapshotCorrectness.cases,
      snapshotPassed: internal.snapshotCorrectness.passed,
      snapshotFailed: internal.snapshotCorrectness.failed,
      fastPathCount: internal.fastPath.count,
      contextRebuilds: internal.rebuildAvoidance.contextRebuilds,
      turns: internal.deterministicAccounting.turns,
      totalReductionPct: internal.deterministicAccounting.totalReductionPct
    },
    empiricalReal: {
      inputTokens: empirical.inputTokens,
      baselineInputTokens: empirical.baselineInputTokens,
      totalTokens: empirical.totalTokens,
      rebuilds: empirical.rebuilds,
      outcomeMatch: empirical.outcomeEquivalence.outcomeMatch,
      evaluated: empirical.outcomeEquivalence.evaluated,
      nonEquivalent: empirical.outcomeEquivalence.nonEquivalent,
      netInputSavings: empirical.netInputSavings,
      invalidComparisons: empirical.INVALID_COMPARISON.length
    },
    externalEvidence: {
      corpus: external.corpus,
      version: external.version,
      sourceCount: external.sourceCount,
      counts: external.counts,
      cachedTokensReportedSeparately: true
    }
  };

  const raw = {
    schema: "rc1-raw@1",
    generatedAt,
    inputsPresent: {
      validationSummary: Boolean(validationSummary),
      realReport: Boolean(realReport),
      evidence: Boolean(evidence)
    },
    validationSummary,
    realReport
  };

  const evidenceJson = {
    schema: "rc1-evidence@1",
    generatedAt,
    ...external
  };

  fs.writeFileSync(path.join(outDir, "raw.json"), `${JSON.stringify(raw, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "evidence.json"), `${JSON.stringify(evidenceJson, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, "report.md"),
    buildMarkdown(internal, empirical, external, comparison, generatedAt)
  );

  // manifest last: it hashes the five artifacts written above (never itself).
  const artifactNames = ["raw.json", "metrics.json", "comparison.json", "evidence.json", "report.md"];
  const artifacts = artifactNames.map((name) => {
    const p = path.join(outDir, name);
    return { path: name, bytes: fs.statSync(p).size, sha256: sha256File(p) };
  });

  const manifest = {
    schema: "rc1-evidence-manifest@1",
    generatedAt,
    suite: "rc1-report",
    separationPolicy: metrics.separationPolicy,
    artifacts
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    outDir,
    artifacts: [...artifactNames, "manifest.json"],
    internal,
    empirical,
    external,
    comparison,
    manifest
  };
}

export { CACHE_CAVEAT };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateRc1Report();
}
