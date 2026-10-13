#!/usr/bin/env node
/**
 * Prompt Iteration & Regression Harness — deterministic, offline.
 *
 * Compares a BASE prompt against a CANDIDATE prompt using identical fixed
 * inputs (fixtures) and produces a reproducible report. A token reduction is
 * reported but NEVER counts as an improvement on its own: acceptance REQUIRES
 * placeholder parity and restriction integrity to hold.
 *
 * Exports `runDiff({ id, candidatePath, root })` so tests can exercise every
 * path without spawning subprocesses. The CLI entry point runs only when this
 * module is executed directly.
 *
 * Usage:
 *   node scripts/prompts-diff.mjs                     # all prompts, base vs base
 *   node scripts/prompts-diff.mjs --id <id>           # one id (repeatable)
 *   node scripts/prompts-diff.mjs --id <id> --candidate <file>   # base vs candidate body
 *   node scripts/prompts-diff.mjs --json              # { results, summary }
 *   node scripts/prompts-diff.mjs --eval              # opt-in real-model (not configured; skipped)
 *   node scripts/prompts-diff.mjs --out <path>        # also write the report to <path>
 *
 * Exit code: 0 when every verdict is accept/unchanged, 1 when any verdict is reject.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPrompt, parseFrontmatter, listPrompts } from "../src/prompts/loader.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PROMPTS_ROOT = path.join(REPO_ROOT, "prompts");
const FIXTURES_ROOT = path.join(PROMPTS_ROOT, "fixtures");
// Interpolation contract mirrored from src/prompts/loader.js so candidate bodies
// render byte-identically to what `loadPrompt(id, vars)` returns for the base.
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
export const EVAL_SKIP_NOTICE = "real-model evaluation not configured; skipped";

/**
 * Cheap relative token proxy (chars/4). `estimateTokens` from
 * `src/skills/engine.js` is intentionally NOT reused: importing that module
 * performs side effects (logger, tmpdir, policy facades) and top-level await,
 * which is incompatible with an offline, side-effect-free harness.
 */
export function estimateTokens(text = "") {
  return Math.ceil(String(text || "").length / 4);
}

export function slugForId(id) {
  return String(id).replace(/\./g, "__");
}

export function fixturePathForId(id, fixturesRoot = FIXTURES_ROOT) {
  return path.join(fixturesRoot, slugForId(id) + ".json");
}

/** Load and validate a fixture for `id`. Throws on missing/malformed fixtures. */
export function loadFixture(id, fixturesRoot = FIXTURES_ROOT) {
  const file = fixturePathForId(id, fixturesRoot);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`prompts-diff: no fixture for "${id}" at "${file}": ${e.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`prompts-diff: invalid fixture JSON for "${id}" at "${file}": ${e.message}`);
  }
  if (data.id !== id) {
    throw new Error(`prompts-diff: fixture "${file}" declares id "${data.id}" but "${id}" was requested`);
  }
  if (data.vars === undefined || typeof data.vars !== "object" || data.vars === null) {
    throw new Error(`prompts-diff: fixture "${file}" must define a "vars" object`);
  }
  for (const field of ["mustContain", "mustNotContain"]) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      throw new Error(`prompts-diff: fixture "${file}" field "${field}" must be an array`);
    }
  }
  return {
    id: data.id,
    vars: data.vars,
    mustContain: data.mustContain || [],
    mustNotContain: data.mustNotContain || [],
  };
}

function collectPlaceholders(body) {
  const used = new Set();
  PLACEHOLDER.lastIndex = 0;
  let match;
  while ((match = PLACEHOLDER.exec(body)) !== null) used.add(match[1]);
  return used;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Apply the loader's interpolation contract to an arbitrary body. */
function renderTemplate(body, vars, id) {
  const supplied = vars || {};
  return body.replace(PLACEHOLDER, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(supplied, name)) {
      throw new Error(`prompts-diff: prompt "${id}" requires variable "${name}" but the fixture supplied none`);
    }
    const value = supplied[name];
    return value === undefined ? "undefined" : String(value);
  });
}

function readBody(filePath) {
  return parseFrontmatter(fs.readFileSync(filePath, "utf8")).body;
}

function lineDiff(aLines, bLines) {
  const n = aLines.length;
  const m = bLines.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push(" " + aLines[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push("-" + aLines[i]);
      i++;
    } else {
      out.push("+" + bLines[j]);
      j++;
    }
  }
  while (i < n) out.push("-" + aLines[i++]);
  while (j < m) out.push("+" + bLines[j++]);
  return out;
}

function unifiedDiff(base, candidate, id) {
  const a = String(base).split("\n");
  const b = String(candidate).split("\n");
  return [`--- a/${id} (base)`, `+++ b/${id} (candidate)`, ...lineDiff(a, b)].join("\n");
}

/**
 * Compare base vs candidate for a single prompt id.
 * @param {{id:string, candidatePath?:string|null, root?:string}} opts
 * @returns {object} deterministic comparison result
 */
export function runDiff({ id, candidatePath = null, root = REPO_ROOT } = {}) {
  if (typeof id !== "string" || !id) {
    throw new Error("prompts-diff: runDiff requires a non-empty id");
  }
  const promptsRoot = path.join(root, "prompts");
  const fixturesRoot = path.join(promptsRoot, "fixtures");
  const fixture = loadFixture(id, fixturesRoot);
  const vars = fixture.vars;

  const entry = listPrompts({ root: promptsRoot }).find((e) => e.id === id);
  if (!entry) {
    throw new Error(`prompts-diff: unknown prompt id "${id}" in "${path.join(promptsRoot, "index.json")}"`);
  }
  const baseFile = path.join(promptsRoot, entry.path);
  const baseBody = readBody(baseFile);
  // Base render is the exact string a consumer receives at runtime.
  const baseRender = loadPrompt(id, vars, { root: promptsRoot });

  let candidateBody = baseBody;
  let candidateRender = baseRender;
  if (candidatePath) {
    candidateBody = readBody(candidatePath);
    candidateRender = renderTemplate(candidateBody, vars, id);
  }

  const placeholdersBase = collectPlaceholders(baseBody);
  const placeholdersCandidate = collectPlaceholders(candidateBody);
  const placeholdersMatch = setsEqual(placeholdersBase, placeholdersCandidate);

  const missingMustContain = fixture.mustContain.filter((s) => !candidateRender.includes(s));
  const offendingMustNotContain = fixture.mustNotContain.filter((s) => candidateRender.includes(s));
  const restrictionIntegrity = {
    ok: missingMustContain.length === 0 && offendingMustNotContain.length === 0,
    missing: missingMustContain,
    offenders: offendingMustNotContain,
  };

  const preserved =
    candidateRender.trim().length > 0 && [...placeholdersBase].every((p) => placeholdersCandidate.has(p));

  const changed = baseRender !== candidateRender;
  const tokensBase = estimateTokens(baseRender);
  const tokensCandidate = estimateTokens(candidateRender);
  const tokensDelta = tokensCandidate - tokensBase;

  let verdict;
  if (!changed) {
    verdict = "unchanged";
  } else if (placeholdersMatch && restrictionIntegrity.ok && preserved) {
    verdict = "accept";
  } else {
    // A token reduction is reported but does NOT flip the verdict.
    verdict = "reject";
  }

  return {
    id,
    changed,
    verdict,
    tokensBase,
    tokensCandidate,
    tokensDelta,
    placeholdersBase: [...placeholdersBase].sort(),
    placeholdersCandidate: [...placeholdersCandidate].sort(),
    placeholdersMatch,
    restrictionIntegrity,
    preserved,
    baseRender,
    candidateRender,
    diff: changed ? unifiedDiff(baseRender, candidateRender, id) : "",
  };
}

function buildReport(results) {
  const summary = { total: results.length, accept: 0, reject: 0, unchanged: 0 };
  for (const r of results) {
    if (r.verdict === "accept") summary.accept++;
    else if (r.verdict === "reject") summary.reject++;
    else summary.unchanged++;
  }
  return { results, summary };
}

function renderMarkdown(report) {
  const { results, summary } = report;
  const lines = [];
  lines.push("# Prompt iteration & regression report");
  lines.push("");
  lines.push(
    `total: ${summary.total} | accept: ${summary.accept} | reject: ${summary.reject} | unchanged: ${summary.unchanged}`,
  );
  lines.push("");
  for (const r of results) {
    lines.push(`## ${r.id} — ${r.verdict}`);
    lines.push(
      `- tokens: base=${r.tokensBase} candidate=${r.tokensCandidate} delta=${r.tokensDelta >= 0 ? "+" : ""}${r.tokensDelta}`,
    );
    lines.push(`- placeholders match: ${r.placeholdersMatch} (base=${JSON.stringify(r.placeholdersBase)})`);
    lines.push(
      `- restriction integrity: ${r.restrictionIntegrity.ok}` +
        (r.restrictionIntegrity.missing.length ? ` missing=${JSON.stringify(r.restrictionIntegrity.missing)}` : "") +
        (r.restrictionIntegrity.offenders.length
          ? ` offenders=${JSON.stringify(r.restrictionIntegrity.offenders)}`
          : ""),
    );
    lines.push(`- preserved: ${r.preserved}`);
    if (r.changed) {
      lines.push("");
      lines.push("```diff");
      lines.push(r.diff);
      lines.push("```");
    }
    lines.push("");
  }
  return lines.join("\n");
}

function getFlagValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`prompts-diff: flag "${flag}" requires a value`);
  }
  return value;
}

/**
 * CLI driver. Returns the process exit code (0 all accept/unchanged, 1 any reject).
 * @param {string[]} argv process.argv.slice(2)
 * @param {{stdout?:(s:string)=>void, stderr?:(s:string)=>void}} [io]
 */
export function runCli(argv = [], io = {}) {
  const out = io.stdout || ((s) => process.stdout.write(s));
  const err = io.stderr || ((s) => process.stderr.write(s));
  const ids = [];
  let candidatePath = null;
  let json = false;
  let evalMode = false;
  let outPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--id") {
      ids.push(getFlagValue(argv, i, arg));
      i++;
    } else if (arg === "--candidate") {
      candidatePath = getFlagValue(argv, i, arg);
      i++;
    } else if (arg === "--out") {
      outPath = getFlagValue(argv, i, arg);
      i++;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--eval") {
      evalMode = true;
    } else if (arg === "--help" || arg === "-h") {
      out("usage: node scripts/prompts-diff.mjs [--id <id>]... [--candidate <file>] [--json] [--eval] [--out <path>]\n");
      return 0;
    } else {
      throw new Error(`prompts-diff: unknown argument "${arg}"`);
    }
  }

  const root = REPO_ROOT;
  const catalogIds = listPrompts({ root: path.join(root, "prompts") })
    .map((e) => e.id)
    .sort();
  const selected = ids.length ? ids.slice() : catalogIds;

  const evalInfo = evalMode ? { requested: true, status: "skipped", notice: EVAL_SKIP_NOTICE } : { requested: false };

  const results = selected.map((id) => runDiff({ id, candidatePath, root }));
  results.sort((a, b) => a.id.localeCompare(b.id));
  const report = buildReport(results);

  let text;
  if (json) {
    text = JSON.stringify({ ...report, eval: evalInfo }, null, 2) + "\n";
  } else {
    const prefix = evalMode ? `# ${EVAL_SKIP_NOTICE}\n\n` : "";
    text = prefix + renderMarkdown(report);
    if (!text.endsWith("\n")) text += "\n";
  }

  out(text);
  if (evalMode) err(`prompts-diff: ${EVAL_SKIP_NOTICE}\n`);
  if (outPath) fs.writeFileSync(outPath, text);

  return report.summary.reject > 0 ? 1 : 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${e && e.message ? e.message : String(e)}\n`);
    process.exitCode = 2;
  }
}
