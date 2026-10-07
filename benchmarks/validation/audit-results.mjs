import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Returns newest subdirectory under root containing raw.json, or null. */
export function latestResultsDir(root = path.resolve("benchmarks/results")) {
  try {
    const dirs = fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
    for (let i = dirs.length - 1; i >= 0; i--) {
      const d = path.join(root, dirs[i], "raw.json");
      if (fs.existsSync(d)) return path.join(root, dirs[i]);
    }
  } catch (_) { return null; }
  return null;
}

/** Git provenance via execFileSync. */
export function gitProvenance() {
  let sha = null;
  let dirty = false;
  let resolvedAt = new Date().toISOString();
  try { sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch (_) { sha = null; }
  try { dirty = Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()); } catch (_) { }
  return { gitSha: sha, dirty, resolvedAt };
}

/** One scenario result object. */
export function buildResult(commit, scenario, baseline, WAM, stateEquivalent, metrics, sourcePath) {
  return {
    commit: String(commit || ""),
    scenario: String(scenario || ""),
    baseline: typeof baseline === "number" ? baseline : null,
    WAM: typeof WAM === "number" ? WAM : null,
    stateEquivalent: Boolean(stateEquivalent),
    metrics: Object.assign({}, metrics || {}),
    source: String(sourcePath || "")
  };
}

/** Validate a single result. Returns array of error strings. */
function validateResult(result) {
  const errors = [];
  if (typeof result !== "object" || result === null) {
    errors.push("result must be an object");
    return errors;
  }
  if (typeof result.commit !== "string" || result.commit.trim() === "") {
    errors.push("result.commit must be a non-empty string");
  }
  if (typeof result.scenario !== "string" || result.scenario.trim() === "") {
    errors.push("result.scenario must be a non-empty string");
  }
  if (typeof result.baseline !== "number" || !Number.isFinite(result.baseline)) {
    errors.push("result.baseline must be a finite number");
  }
  if (typeof result.WAM !== "number" || !Number.isFinite(result.WAM)) {
    errors.push("result.WAM must be a finite number");
  }
  if (result.stateEquivalent !== true) {
    errors.push("result.stateEquivalent must be true");
  }
  if (!result.metrics || typeof result.metrics !== "object") {
    errors.push("result.metrics must be an object");
  } else {
    const m = result.metrics;
    if (typeof m.baselineTotalTokens !== "undefined" && typeof m.baselineTotalTokens !== "number") {
      errors.push("metrics.baselineTotalTokens must be a number if present");
    }
    if (typeof m.totalTokens !== "undefined" && typeof m.totalTokens !== "number") {
      errors.push("metrics.totalTokens must be a number if present");
    }
    if (typeof m.baselineTotalTokens === "number" && m.baselineTotalTokens !== result.baseline) {
      errors.push("metrics.baselineTotalTokens present and !== baseline");
    }
    if (typeof m.totalTokens === "number" && m.totalTokens !== result.WAM) {
      errors.push("metrics.totalTokens present and !== WAM");
    }
  }
  return errors;
}

/** Validate all results. Returns { ok, resultsChecked, errors }. */
export function validateResults(results) {
  if (!Array.isArray(results)) {
    return { ok: false, resultsChecked: 0, errors: ["results must be an array"] };
  }
  if (results.length === 0) {
    return { ok: false, resultsChecked: 0, errors: ["empty results array"] };
  }
  const allErrors = [];
  for (let i = 0; i < results.length; i++) {
    const rErrors = validateResult(results[i]);
    if (rErrors.length > 0) {
      for (const e of rErrors) allErrors.push(`result[${i}]: ${e}`);
    }
  }
  return {
    ok: allErrors.length === 0,
    resultsChecked: results.length,
    errors: allErrors
  };
}

/** Build full audit JSON. */
function buildAudit(resultsDir) {
  const provenance = gitProvenance();
  const results = [];
  const latestDir = latestResultsDir(resultsDir);
  if (latestDir) {
    const raw = JSON.parse(fs.readFileSync(path.join(latestDir, "raw.json"), "utf8"));
    const scenarioIds = raw.composition?.scenarioIds || [];
    for (let i = 0; i < scenarioIds.length; i++) {
      const id = scenarioIds[i];
      const s = raw.causal?.scenarios?.[id] || {};
      results.push(buildResult(
        provenance.gitSha,
        id,
        s.baselineTotalTokens,
        s.totalTokens,
        s.verification === "success",
        { totalTokens: s.totalTokens, baselineTotalTokens: s.baselineTotalTokens, inputTokens: s.inputTokens, outputTokens: s.outputTokens, contextRebuilds: s.contextRebuilds },
        `benchmarks/results/${path.basename(latestDir)}/raw.json`
      ));
    }
  }
  return {
    schema: "bench-audit@1",
    provenance,
    results,
    validation: validateResults(results)
  };
}

/** Write audit JSON to file. */
function writeAudit(audit, outPath = path.resolve("benchmarks/validation/audit.json")) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(audit, null, 2) + "\n");
  return outPath;
}

/** CLI entry point. */
function main() {
  const args = process.argv.slice(2);
  const buildFlag = args.includes("--build");

  if (buildFlag) {
    const audit = buildAudit();
    writeAudit(audit);
    console.log(JSON.stringify(audit.validation));
    process.exit(audit.validation.ok ? 0 : 1);
  } else {
    const audit = buildAudit();
    console.log(JSON.stringify(audit.validation));
    process.exit(audit.validation.ok ? 0 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}