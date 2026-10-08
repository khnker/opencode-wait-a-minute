#!/usr/bin/env node
/**
 * WAM Skill Builder — build-time only (maintainer).
 *
 * Convierte repos upstream clonados localmente en el catalogo curado
 * skills/registry.json que WAM distribuye embebido. Sin red.
 *
 * Uso:
 *   node scripts/sync-upstream.cjs   # clonar/fetchar primero
 *   node scripts/build-registry.cjs  # escanear y escribir registry.json
 *
 * Para ejecutarlo desde cualquier cwd, los clones se esperan bajo
 * <repo-root>/upstream/<id>/, donde <id> es el identificador de cada
 * entrada en scripts/sources.cjs.
 */

const fs = require("fs");
const path = require("path");
const { SOURCE_CONFIG } = require("./sources.cjs");

const REPO_DIR = path.resolve(__dirname, "..");
const UPSTREAM_DIR = path.join(REPO_DIR, "upstream");
const OUT = path.join(REPO_DIR, "skills", "registry.json");

function readSafe(p) { try { return fs.readFileSync(p, "utf8"); } catch { return ""; } }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

const BLOCK_RE = /^([|>][-+]?)\s*$/;

/**
 * Parse a YAML frontmatter into { name, description, keywords, body }.
 *
 * Supports:
 *   - simple scalars     name: foo
 *   - quoted scalars     name: "foo bar"
 *   - block scalars      description: > / description: |   (and - / + chomp variants)
 *   - inline lists       keywords: [a, b, c]
 *   - hyphen-lists       keywords:\n  - a\n  - b
 *
 * Folded scalars (">" family) collapse inner newlines and runs of
 * whitespace into a single space. Literal scalars ("|" family) preserve
 * newlines but lose the leading indentation level.
 */
function parseFrontmatter(content) {
  const meta = { name: "", description: "", keywords: [], body: "" };
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return meta;
  const raw = m[1];
  const lines = raw.split("\n");

  function readBlockScalar(startIdx, marker) {
    const isFolded = marker[0] === ">";
    // detect base indent from the first non-empty continuation line
    let baseIndent = 0;
    for (let k = startIdx; k < lines.length; k++) {
      const t = lines[k];
      if (t.trim() === "") continue;
      baseIndent = (t.match(/^(\s*)/)[1] || "").length;
      break;
    }
    const collected = [];
    let j = startIdx;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === "") { collected.push(""); continue; }
      const ind = l.match(/^(\s*)/)[1].length;
      if (ind < baseIndent) break;
      collected.push(l.slice(baseIndent));
    }
    while (collected.length && collected[collected.length - 1] === "") collected.pop();
    let value = collected.join("\n");
    if (isFolded) {
      // YAML folded: collapse newlines and any whitespace runs to a single space
      value = value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
    } else {
      // literal: trim trailing whitespace per line, drop final blank lines
      value = value.replace(/[ \t]+\n/g, "\n").replace(/\n+$/, "");
    }
    return { value, nextIndex: j };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i += 1; continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) { i += 1; continue; }
    const key = kv[1].toLowerCase();
    const tailRaw = (kv[2] || "");
    const tail = tailRaw.trim();

    // Block scalar — marker may be the entire value ("description: >") OR
    // appear alone on a continuation line right after a key with empty value.
    if (BLOCK_RE.test(tail)) {
      const { value, nextIndex } = readBlockScalar(i + 1, tail);
      if (key === "name") meta.name = value;
      else if (key === "description") meta.description = value;
      else if (key === "keywords") {
        meta.keywords = String(value).split(/\s+/).filter(Boolean);
      }
      i = nextIndex;
      continue;
    }

    // empty value → look for block scalar on next line, otherwise fall through
    if (tail === "") {
      if (i + 1 < lines.length && BLOCK_RE.test((lines[i + 1] || "").trim())) {
        const marker = (lines[i + 1] || "").trim();
        const { value, nextIndex } = readBlockScalar(i + 2, marker);
        if (key === "name") meta.name = value;
        else if (key === "description") meta.description = value;
        else if (key === "keywords") {
          meta.keywords = String(value).split(/\s+/).filter(Boolean);
        }
        i = nextIndex;
        continue;
      }
      i += 1;
      continue;
    }

    if (key === "name") meta.name = tail.replace(/^["']|["']$/g, "");
    else if (key === "description") meta.description = tail.replace(/^["']|["']$/g, "");
    else if (key === "keywords") {
      if (tail.startsWith("[") && tail.endsWith("]")) {
        meta.keywords = tail
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      } else {
        meta.keywords = [tail.replace(/^["']|["']$/g, "")];
      }
    }
    i += 1;
  }

  meta.body = content.slice(m[0].length).trim();
  return meta;
}

function gitCommit(dir) {
  const head = readSafe(path.join(dir, ".git", "HEAD")).trim().replace(/^ref:\s*/, "");
  if (!head) return null;
  const sha = readSafe(path.join(dir, ".git", head)).trim();
  return sha || head;
}

function deriveKeywords(name, explicit) {
  const tokens = String(name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  const merged = [...(explicit || []), ...tokens];
  return [...new Set(merged)];
}

function scanSource(source, rootDir) {
  if (!exists(rootDir)) return [];
  const scanRoots = source.skillsPath
    ? [path.join(rootDir, source.skillsPath)].filter(exists)
    : [rootDir];

  const baseSet = new Set((source.baseSkills || []).map((s) => String(s).toLowerCase()));

  const found = [];
  const walk = (d, relBase) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full, relBase);
      else if (e.name === "SKILL.md") {
        const raw = readSafe(full);
        const fm = parseFrontmatter(raw);
        const relPath = path.relative(relBase, full).replace(/\\/g, "/");
        const slug = (fm.name || path.basename(path.dirname(full))).toLowerCase().replace(/[^a-z0-9]+/g, "-");
        if (slug.length < 2 || fm.description.length < 20) continue;
        const entry = {
          id: `${source.id}-${slug}`,
          name: fm.name || slug,
          description: fm.description,
          keywords: deriveKeywords(fm.name || slug, fm.keywords),
          capabilities: [],
          domain: [],
          compatibility: ["opencode"],
          risk: "low",
          source: { id: source.id, repository: source.repository, path: relPath, ref: gitCommit(rootDir) || "unknown" },
          status: "APPROVED",
          trust: source.trust,
          content: fm.body,
        };
        if (baseSet.size > 0) {
          const nameSlug = (fm.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
          if (baseSet.has(nameSlug) || baseSet.has(slug)) {
            entry.loadStrategy = "base";
          }
        }
        found.push(entry);
      }
    }
  };
  for (const r of scanRoots) walk(r, r);
  return found;
}

function dedup(registry) {
  const seen = new Map();
  const out = {};
  for (const s of registry) {
    const key = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (seen.has(key)) continue;
    seen.set(key, true);
    out[s.id] = s;
  }
  return out;
}

const MANUAL = [
  { id: "security-review", name: "security-review", description: "Security audit and vulnerability review of code, dependencies and infrastructure", keywords: ["security", "seguridad", "vulnerability", "audit", "auth", "oauth"], risk: "high" },
  { id: "postgres-migration", name: "postgres-migration", description: "PostgreSQL database migrations planned and executed without data loss or downtime", keywords: ["migration", "migracion", "postgres", "database", "db", "schema"], risk: "high" },
  { id: "code-review", name: "code-review", description: "Code review focused on maintainability, correctness and future complexity", keywords: ["review", "code-review", "revision", "maintainability", "quality", "pull request"], risk: "medium" },
  { id: "debugging", name: "debugging", description: "Diagnosis of errors, bugs and regressions with root-cause analysis", keywords: ["debug", "bug", "error", "fallo", "regression", "trace"], risk: "medium" },
];

const all = [];
for (const source of SOURCE_CONFIG) {
  const dir = path.join(UPSTREAM_DIR, source.id);
  const skills = scanSource(source, dir);
  console.log(`${source.id}: ${skills.length} skills`);
  all.push(...skills);
}
for (const m of MANUAL) {
  all.push({ ...m, capabilities: [], domain: [], compatibility: ["opencode"], source: { kind: "bundled", ref: "wam-v1" }, status: "APPROVED", trust: "curated" });
}

const deduped = dedup(all);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(Object.values(deduped), null, 2));
console.log(`-> ${OUT}`);
console.log(`Total curado: ${Object.keys(deduped).length} skills (dedup aplicado)`);
