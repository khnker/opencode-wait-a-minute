#!/usr/bin/env node
/**
 * Prompt Source-of-Truth Audit — read-only, deterministic.
 *
 * Scans WAM source (*.js, *.mjs) for model-directed strings and cross-references
 * them against the `prompts/` catalog. It NEVER mutates files and NEVER migrates
 * prompts — the only side effect is an optional report written with `--out`.
 *
 * Usage:
 *   node scripts/prompts-audit.mjs                 # human-readable markdown to stdout
 *   node scripts/prompts-audit.mjs --json          # machine-readable JSON to stdout
 *   node scripts/prompts-audit.mjs --strict        # exit 1 on orphans / stale refs / duplicates
 *   node scripts/prompts-audit.mjs --out <path>    # also write the report to <path>
 *
 * The report lists each detected model-directed site as file:line, the construct
 * that produced it, and whether it routes through `loadPrompt` (centralized) or is
 * a raw literal classified as `candidate` / `deterministic`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPrompt, parseFrontmatter } from "../src/prompts/loader.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PROMPTS_ROOT = path.join(REPO_ROOT, "prompts");
const CATALOG_PATH = path.join(PROMPTS_ROOT, "index.json");

const INCLUDED_EXT = new Set([".js", ".mjs"]);
const EXCLUDED_DIRNAMES = new Set([
  "node_modules",
  "vendor",
  "openspec",
  "dist",
  "coverage",
  // vendored clone, gitignored: /upstream/ is maintainer build-time content
  "upstream",
]);
const EXCLUDED_REL_PREFIXES = ["benchmarks/artifact-outcome"];
// Any directory whose name starts with "." is skipped (.git, .wam, .cqe, .tgrep, ...).

/**
 * Explicit deterministic classification patterns. A raw literal matching any of
 * these is NOT instructional and MUST NOT be treated as a migration candidate.
 * Regexes are listed verbatim in the report.
 */
const DETERMINISTIC_PATTERNS = [
  {
    label: "error-class-prefix",
    pattern:
      "^(Error|TypeError|RangeError|SyntaxError|URIError|ReferenceError|EvalError|AggregateError)\\b",
  },
  { label: "wam-error-code", pattern: "^WAM_[A-Z0-9_]+\\b" },
  { label: "error-code", pattern: "^ERR_[A-Z0-9_]+\\b" },
  { label: "log-label", pattern: "^(log|error|warn|info|debug|trace|fatal)\\s*:" },
  {
    label: "identifier-or-dotted-path-only",
    pattern: "^[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)*$",
  },
  {
    label: "pure-interpolation",
    pattern: "^(?:\\s|\\$\\{[^}]*\\}|\\{\\{[^}]*\\}\\}|[^A-Za-z])*$",
  },
];

/** Call-shaped heuristics: literal argument index per construct. */
const CALL_CONSTRUCTS = {
  emitTextPart: { name: "emitTextPart", arg: 1 },
  spend: { name: "spend", arg: 1 },
  "parts.push": { name: "parts.push", arg: 0 },
  "output.parts.push": { name: "output.parts.push", arg: 0 },
  "out.parts.push": { name: "out.parts.push", arg: 0 },
};

const PROPERTY_KEYS = ["nudge", "warning", "reason", "restrictions"];
const LOAD_PROMPT_RE = /loadPrompt\(\s*(["'`])([^"'`]+)\1/g;
const WAM_MARKER_RE = /\[wam N\d/;
const RULES_ARRAY_RE = /rules\s*:\s*\[/g;

function warn(msg) {
  process.stderr.write(`warn: ${msg}\n`);
}

function classify(text) {
  const t = String(text).trim();
  for (const p of DETERMINISTIC_PATTERNS) {
    if (new RegExp(p.pattern).test(t)) return { cls: "deterministic", rule: p.label };
  }
  return { cls: "candidate", rule: null };
}

function lineResolver(content) {
  const starts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") starts.push(i + 1);
  }
  return (idx) => {
    let lo = 0;
    let hi = starts.length - 1;
    let ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (starts[mid] <= idx) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans + 1;
  };
}

function captureLiteral(content, start, end) {
  let i = start;
  const limit = end === undefined ? content.length : end;
  while (i < limit && /\s/.test(content[i])) i++;
  const q = content[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let j = i + 1;
  while (j < limit) {
    const ch = content[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === q) break;
    j++;
  }
  if (j >= limit) return null;
  return { value: content.slice(i + 1, j), raw: content.slice(i, j + 1), start: i, end: j + 1 };
}

function parseTopLevelArgs(content, openParen) {
  const args = [];
  let i = openParen + 1;
  let depth = 0;
  let argStart = i;
  let inStr = null;
  for (; i < content.length; i++) {
    const ch = content[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0 && ch === ")") break;
      depth--;
    } else if (ch === "," && depth === 0) {
      args.push([argStart, i]);
      argStart = i + 1;
    }
  }
  args.push([argStart, i]);
  return args;
}

function findLiteralContaining(line, needle) {
  for (let i = 0; i < line.length; i++) {
    const q = line[i];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    let j = i + 1;
    while (j < line.length) {
      const ch = line[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === q) break;
      j++;
    }
    if (j >= line.length) break;
    const value = line.slice(i + 1, j);
    if (value.includes(needle)) return { value, start: i, end: j + 1 };
    i = j;
  }
  return null;
}

function makeSite(file, line, construct, value) {
  const snippet = value.replace(/`/g, "'").replace(/\s+/g, " ").trim().slice(0, 160);
  return { file, line, construct, snippet, text: value };
}

function scanRulesArrays(content, relPath, toLine, sites) {
  RULES_ARRAY_RE.lastIndex = 0;
  let m;
  while ((m = RULES_ARRAY_RE.exec(content)) !== null) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '"' || ch === "'" || ch === "`") {
        const lit = captureLiteral(content, i, content.length);
        if (lit) {
          sites.push(makeSite(relPath, toLine(i), "rules-array", lit.value));
          i = lit.end;
          continue;
        }
      }
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
      i++;
    }
  }
}

function scanFile(file) {
  let content;
  try {
    content = fs.readFileSync(file.abs, "utf8");
  } catch (e) {
    warn(`cannot read ${file.rel}: ${e.message}`);
    return { sites: [], centralized: [] };
  }

  const toLine = lineResolver(content);
  const sites = [];
  const centralized = [];

  // 1) Centralized sites: loadPrompt("<id>") code references.
  LOAD_PROMPT_RE.lastIndex = 0;
  let lm;
  while ((lm = LOAD_PROMPT_RE.exec(content)) !== null) {
    centralized.push({ id: lm[2].trim(), file: file.rel, line: toLine(lm.index) });
  }

  // 2) Call-shaped raw literals (content arg is a literal, not loadPrompt/variable).
  for (const key of Object.keys(CALL_CONSTRUCTS)) {
    const { name, arg } = CALL_CONSTRUCTS[key];
    let idx = 0;
    while ((idx = content.indexOf(name + "(", idx)) !== -1) {
      const prev = content[idx - 1];
      if (prev && /[A-Za-z0-9_$.]/.test(prev)) {
        idx += name.length;
        continue;
      }
      const open = idx + name.length;
      const args = parseTopLevelArgs(content, open);
      const a = args[arg];
      if (a) {
        const lit = captureLiteral(content, a[0], a[1] === undefined ? content.length : a[1]);
        if (lit) sites.push(makeSite(file.rel, toLine(idx), name, lit.value));
      }
      idx = open + 1;
    }
  }

  // 3) Line-shaped heuristics: property assignments and `[wam N*]` markers.
  const propRe = new RegExp(
    `(?<![\\w$.])(${PROPERTY_KEYS.join("|")})\\s*:\\s*(["'\`])`,
    "g",
  );
  const lines = content.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    propRe.lastIndex = 0;
    let pm;
    while ((pm = propRe.exec(line)) !== null) {
      const qIdx = pm.index + pm[0].length - 1;
      const lit = captureLiteral(line, qIdx, line.length);
      if (lit) sites.push(makeSite(file.rel, li + 1, `property:${pm[1]}`, lit.value));
    }
    if (WAM_MARKER_RE.test(line)) {
      const marker = findLiteralContaining(line, "[wam N");
      if (marker) sites.push(makeSite(file.rel, li + 1, "wam-marker", marker.value));
    }
  }

  // 4) PERSISTENT_POLICIES-style `rules: [ ... ]` string literals.
  scanRulesArrays(content, file.rel, toLine, sites);

  return { sites, centralized };
}

function walk(dir, rel, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    warn(`cannot read directory ${rel || "."}: ${e.message}`);
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    const childRel = rel ? `${rel}/${name}` : name;
    if (ent.isDirectory()) {
      if (name.startsWith(".")) continue;
      if (EXCLUDED_DIRNAMES.has(name)) continue;
      if (EXCLUDED_REL_PREFIXES.some((p) => childRel === p || childRel.startsWith(p + "/"))) {
        continue;
      }
      walk(path.join(dir, name), childRel, out);
    } else if (ent.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (INCLUDED_EXT.has(ext)) out.push({ abs: path.join(dir, name), rel: childRel });
    }
  }
}

function normalizeText(s) {
  return String(s)
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\$\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function promptBody(entry) {
  try {
    return String(loadPrompt(entry.id));
  } catch {
    try {
      const raw = fs.readFileSync(path.join(PROMPTS_ROOT, entry.path), "utf8");
      return parseFrontmatter(raw).body;
    } catch (e) {
      warn(`cannot load body for ${entry.id}: ${e.message}`);
      return "";
    }
  }
}

function siteCmp(a, b) {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  if (a.construct !== b.construct) return a.construct < b.construct ? -1 : 1;
  return a.snippet < b.snippet ? -1 : a.snippet > b.snippet ? 1 : 0;
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/**
 * Run the audit. Pure: returns the report model, writes nothing.
 */
export function runAudit() {
  const files = [];
  walk(REPO_ROOT, "", files);

  const allSites = [];
  const centralizedSites = [];
  for (const f of files) {
    const { sites, centralized } = scanFile(f);
    allSites.push(...sites);
    centralizedSites.push(...centralized);
  }

  // Deduplicate identical site detections (same location + same literal text).
  const seen = new Set();
  const deduped = [];
  for (const s of allSites) {
    const k = `${s.file}|${s.line}|${s.snippet}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(s);
  }

  const categorized = deduped
    .map((s) => {
      const c = classify(s.text);
      return { ...s, classification: c.cls, deterministicRule: c.rule };
    })
    .sort(siteCmp);

  const candidateSites = categorized.filter((s) => s.classification === "candidate");
  const deterministicSites = categorized.filter((s) => s.classification === "deterministic");

  let catalog = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    catalog = Array.isArray(parsed) ? parsed : Array.isArray(parsed.prompts) ? parsed.prompts : [];
  } catch (e) {
    warn(`cannot read catalog ${CATALOG_PATH}: ${e.message}`);
  }

  const centralizedIds = new Set(centralizedSites.map((s) => s.id));
  const orphanPrompts = catalog
    .filter((e) => !centralizedIds.has(e.id))
    .map((e) => ({ id: e.id, path: e.path }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const staleConsumerRefs = [];
  for (const e of catalog) {
    for (const c of e.consumers || []) {
      const p = String(c).split("#")[0].trim();
      if (!p) continue;
      if (!fs.existsSync(path.join(REPO_ROOT, p))) {
        staleConsumerRefs.push({ id: e.id, consumer: c, missingPath: p });
      }
    }
  }
  staleConsumerRefs.sort(
    (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || (a.consumer < b.consumer ? -1 : 1),
  );

  const promptNorm = new Map();
  for (const e of catalog) {
    const body = normalizeText(promptBody(e));
    if (body) promptNorm.set(body, e.id);
    if (e.responsibility) promptNorm.set(normalizeText(e.responsibility), e.id);
    if (e.purpose) promptNorm.set(normalizeText(e.purpose), e.id);
  }

  const duplicateCandidates = [];
  for (const s of candidateSites) {
    const n = normalizeText(s.text);
    if (!n) continue;
    const id = promptNorm.get(n);
    if (id) {
      duplicateCandidates.push({
        id,
        file: s.file,
        line: s.line,
        construct: s.construct,
        snippet: s.snippet,
      });
    }
  }
  duplicateCandidates.sort(
    (a, b) =>
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) ||
      a.line - b.line,
  );

  return {
    summary: {
      filesScanned: files.length,
      registeredPrompts: catalog.length,
      loadPromptSites: centralizedSites.length,
      centralizedIds: centralizedIds.size,
      candidateSites: candidateSites.length,
      deterministicSites: deterministicSites.length,
      orphanPrompts: orphanPrompts.length,
      staleConsumerRefs: staleConsumerRefs.length,
      duplicateCandidates: duplicateCandidates.length,
    },
    exclusions: {
      dirNames: [...EXCLUDED_DIRNAMES].sort(),
      relPrefixes: [...EXCLUDED_REL_PREFIXES].sort(),
      dotDirectories: true,
    },
    deterministicPatterns: DETERMINISTIC_PATTERNS.map((p) => ({ ...p })),
    centralizedSites: centralizedSites
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) || a.line - b.line),
    orphanPrompts,
    staleConsumerRefs,
    duplicateCandidates,
    candidateSites: candidateSites.map((s) => ({
      file: s.file,
      line: s.line,
      construct: s.construct,
      snippet: s.snippet,
      text: s.text,
    })),
    deterministicSites: deterministicSites.map((s) => ({
      file: s.file,
      line: s.line,
      construct: s.construct,
      snippet: s.snippet,
      rule: s.deterministicRule,
    })),
  };
}

export function renderMarkdown(m) {
  const L = [];
  L.push("# Prompt Source-of-Truth Audit");
  L.push("");
  L.push(
    "> Read-only, deterministic report generated by `scripts/prompts-audit.mjs`. No files are modified and no prompt is migrated.",
  );
  L.push("");
  L.push("## Summary");
  L.push(`- Files scanned: ${m.summary.filesScanned}`);
  L.push(`- Registered prompts: ${m.summary.registeredPrompts}`);
  L.push(
    `- \`loadPrompt\` sites (centralized): ${m.summary.loadPromptSites} (${m.summary.centralizedIds} distinct ids)`,
  );
  L.push(`- Raw candidate sites: ${m.summary.candidateSites}`);
  L.push(`- Deterministic raw sites: ${m.summary.deterministicSites}`);
  L.push(`- Registered but unused (orphan prompts): ${m.summary.orphanPrompts}`);
  L.push(`- Stale consumer refs: ${m.summary.staleConsumerRefs}`);
  L.push(`- Duplicate candidates: ${m.summary.duplicateCandidates}`);
  L.push("");
  L.push("## Deterministic classification patterns");
  for (const p of m.deterministicPatterns) {
    L.push(`- \`${p.label}\` — \`${p.pattern}\``);
  }
  L.push("");
  L.push(`## Registered but unused (${m.orphanPrompts.length})`);
  if (!m.orphanPrompts.length) L.push("- _none_");
  for (const o of m.orphanPrompts) L.push(`- \`${o.id}\` (${o.path})`);
  L.push("");
  L.push(`## Stale consumer refs (${m.staleConsumerRefs.length})`);
  if (!m.staleConsumerRefs.length) L.push("- _none_");
  for (const s of m.staleConsumerRefs) {
    L.push(`- \`${s.id}\` → \`${s.consumer}\` (missing: \`${s.missingPath}\`)`);
  }
  L.push("");
  L.push(`## Duplicate candidates (${m.duplicateCandidates.length})`);
  if (!m.duplicateCandidates.length) L.push("- _none_");
  for (const d of m.duplicateCandidates) {
    L.push(`- \`${d.id}\` ← ${d.file}:${d.line} [${d.construct}] \`${d.snippet}\``);
  }
  L.push("");
  L.push(`## Raw candidate sites (${m.candidateSites.length}), grouped by file`);
  const byFile = groupBy(m.candidateSites, (s) => s.file);
  for (const file of [...byFile.keys()].sort()) {
    L.push(`### \`${file}\``);
    for (const s of byFile.get(file)) {
      L.push(`- L${s.line} [${s.construct}] \`${s.snippet}\``);
    }
    L.push("");
  }
  if (!m.candidateSites.length) L.push("- _none_");
  L.push("");
  L.push(`## Deterministic sites: ${m.deterministicSites.length}`);
  return L.join("\n") + "\n";
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const strict = args.includes("--strict");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

  const model = runAudit();
  const output = asJson ? JSON.stringify(model, null, 2) + "\n" : renderMarkdown(model);

  if (outPath) {
    try {
      fs.writeFileSync(outPath, output, "utf8");
    } catch (e) {
      warn(`cannot write report to ${outPath}: ${e.message}`);
    }
  }

  process.stdout.write(output);

  const hasIssues =
    model.orphanPrompts.length > 0 ||
    model.staleConsumerRefs.length > 0 ||
    model.duplicateCandidates.length > 0;
  if (strict && hasIssues) process.exitCode = 1;
}

const isMain =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
