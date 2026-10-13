#!/usr/bin/env node
/**
 * Prompt Catalog Integrity Check — deterministic, read-only.
 *
 * Turns `prompts/index.json` into a verifiable contract. Exports
 * `runChecks({ root })` (returns `{ ok, violations, count, checks }`) so tests
 * can exercise every failure path without spawning subprocesses. The CLI entry
 * point only runs when this module is executed directly.
 *
 * Checks: catalog structure, interpolation contract, reference resolution and
 * usage agreement between `loadPrompt("<id>")` call sites and the catalog.
 *
 * Usage:
 *   node scripts/prompts-check.mjs          # human-readable, exit 1 on any violation
 *   node scripts/prompts-check.mjs --json   # violations as JSON (still exits 1)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFrontmatter } from "../src/prompts/loader.js";

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
const LOAD_PROMPT_RE = /loadPrompt\(\s*(["'])([^"']+)\1/g;

const REQUIRED_FIELDS = [
  "id",
  "name",
  "purpose",
  "consumer",
  "inputs",
  "output",
  "restrictions",
  "verification",
  "dependencies",
  "status",
];

// Directories never scanned for `loadPrompt()` usage.
const USAGE_EXCLUDED_DIRS = new Set([
  "node_modules",
  "vendor",
  ".git",
  "openspec",
  "dist",
  "coverage",
]);
// Scripts whose own source mentions `loadPrompt(` and must not count as usage.
const USAGE_SELF_FILES = new Set([
  "scripts/prompts-check.mjs",
  "scripts/prompts-audit.mjs",
]);

const CHECK_COUNT = 5;

function defaultRoot() {
  return path.resolve(fileURLToPath(new URL("../", import.meta.url)));
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectPlaceholders(body) {
  const used = new Set();
  PLACEHOLDER.lastIndex = 0;
  let match;
  while ((match = PLACEHOLDER.exec(body)) !== null) used.add(match[1]);
  return used;
}

function walkFiles(dir, out, { markdown = false } = {}) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const name = entry.name;
    const full = path.join(dir, name);
    if (entry.isDirectory()) {
      if (name.startsWith(".")) continue;
      if (USAGE_EXCLUDED_DIRS.has(name)) continue;
      walkFiles(full, out, { markdown });
    } else if (entry.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (markdown ? ext === ".md" : ext === ".js" || ext === ".mjs") out.push(full);
    }
  }
  return out;
}

function scanPromptFiles(promptsRoot) {
  return walkFiles(promptsRoot, [], { markdown: true });
}

function scanUsage(root) {
  const found = new Set();
  for (const file of walkFiles(root, [])) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (rel.endsWith(".test.mjs")) continue;
    if (USAGE_SELF_FILES.has(rel)) continue;
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    LOAD_PROMPT_RE.lastIndex = 0;
    let match;
    while ((match = LOAD_PROMPT_RE.exec(content)) !== null) found.add(match[2].trim());
  }
  return found;
}

export function runChecks({ root = defaultRoot() } = {}) {
  const repoRoot = path.resolve(root);
  const promptsRoot = path.join(repoRoot, "prompts");
  const indexPath = path.join(promptsRoot, "index.json");
  const violations = [];
  const add = (scope, problem) => violations.push({ scope, problem });
  const fail = () => ({ ok: false, violations, count: 0, checks: CHECK_COUNT });

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch (e) {
    add("prompts/index.json", `cannot read catalog: ${e.message}`);
    return fail();
  }

  const entries = Array.isArray(catalog)
    ? catalog
    : catalog && Array.isArray(catalog.prompts)
      ? catalog.prompts
      : null;
  if (!entries) {
    add("prompts/index.json", "must be an array of prompt entries (or { prompts: [...] })");
    return fail();
  }

  const seen = new Map();
  const ids = new Set();

  for (const entry of entries) {
    // ── 1. Catalog Structural Validation ──────────────────────────────────
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      add("catalog", "entry without a valid id");
      continue;
    }
    if (seen.has(entry.id)) add(entry.id, `duplicate id "${entry.id}"`);
    seen.set(entry.id, entry);
    ids.add(entry.id);

    if (typeof entry.path !== "string" || !entry.path) {
      add(entry.id, "catalog entry is missing a path");
      continue;
    }
    const relPath = entry.path;
    if (path.isAbsolute(relPath)) {
      add(entry.id, `path must be relative, got absolute "${relPath}"`);
      continue;
    }
    if (!relPath.endsWith(".md")) {
      add(entry.id, `path must be a .md file: ${relPath}`);
      continue;
    }
    const resolved = path.resolve(promptsRoot, relPath);
    const confined = path.relative(promptsRoot, resolved);
    if (confined.startsWith("..") || path.isAbsolute(confined)) {
      add(entry.id, `path escapes prompts/: ${relPath}`);
      continue;
    }
    if (!fs.existsSync(resolved)) {
      add(entry.id, `path does not exist: ${relPath}`);
      continue;
    }

    const { data, body } = parseFrontmatter(fs.readFileSync(resolved, "utf8"));
    for (const field of REQUIRED_FIELDS) {
      if (!(field in data) || data[field] === "") {
        add(entry.id, `frontmatter missing "${field}"`);
      }
    }
    if (data.id && data.id !== entry.id) {
      add(entry.id, `frontmatter id "${data.id}" does not match catalog id`);
    }
    if (data.status && entry.status && data.status !== entry.status) {
      add(entry.id, `status mismatch catalog="${entry.status}" frontmatter="${data.status}"`);
    }

    // ── 2. Interpolation Contract ─────────────────────────────────────────
    const declared = new Set(Array.isArray(data.inputs) ? data.inputs : []);
    const used = collectPlaceholders(body);
    for (const name of used) {
      if (!declared.has(name)) add(entry.id, `undeclared placeholder {{${name}}} (not in inputs)`);
    }
    for (const name of declared) {
      if (!used.has(name)) add(entry.id, `declared input "${name}" is never used in body`);
    }

    // ── 3. Reference Resolution ───────────────────────────────────────────
    for (const ref of Array.isArray(entry.consumers) ? entry.consumers : []) {
      const [file, symbol] = String(ref).split("#");
      const abs = path.resolve(repoRoot, file);
      if (!fs.existsSync(abs)) {
        add(entry.id, `consumer file not found: ${ref}`);
        continue;
      }
      if (symbol) {
        const source = fs.readFileSync(abs, "utf8");
        if (!new RegExp(`\\b${escapeRe(symbol)}\\b`).test(source)) {
          add(entry.id, `consumer symbol "${symbol}" not found in ${file}`);
        }
      }
    }
    for (const ref of Array.isArray(entry.testRefs) ? entry.testRefs : []) {
      const abs = path.resolve(repoRoot, ref);
      if (!fs.existsSync(abs)) add(entry.id, `testRef not found: ${ref}`);
    }
  }

  // Unregistered prompt files.
  const registered = new Set(
    entries.filter((e) => e && typeof e.path === "string").map((e) => path.normalize(e.path)),
  );
  for (const file of scanPromptFiles(promptsRoot)) {
    if (path.basename(file) === "README.md") continue;
    const rel = path.relative(promptsRoot, file);
    if (!registered.has(path.normalize(rel))) add("prompts/", `unregistered prompt file: ${rel}`);
  }

  // ── 4. Usage Agreement ──────────────────────────────────────────────────
  const usage = scanUsage(repoRoot);
  for (const id of ids) {
    if (!usage.has(id)) add(id, "registered prompt has no loadPrompt() usage in non-test source");
  }
  for (const id of usage) {
    if (!ids.has(id)) add("usage", `loadPrompt("${id}") is not registered in the catalog`);
  }

  return { ok: violations.length === 0, violations, count: entries.length, checks: CHECK_COUNT };
}

function main() {
  const asJson = process.argv.slice(2).includes("--json");
  const { ok, violations, count, checks } = runChecks();
  if (ok) {
    console.log(`prompts:check: OK (${count} prompts, ${checks} checks)`);
    process.exit(0);
  }
  if (asJson) {
    console.log(JSON.stringify({ ok: false, violations }, null, 2));
  } else {
    console.error(`prompts:check: ${violations.length} problem(s):`);
    for (const { scope, problem } of violations) console.error(`- ${scope}: ${problem}`);
  }
  process.exit(1);
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
