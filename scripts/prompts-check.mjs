import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../src/prompts/loader.js";

const repoRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const promptsRoot = path.join(repoRoot, "prompts");
const indexPath = path.join(promptsRoot, "index.json");
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
const errors = [];

function rel(target) {
  return path.relative(repoRoot, target);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(indexPath, "utf8"));
} catch (e) {
  console.error(`prompts:check: cannot read ${rel(indexPath)}: ${e.message}`);
  process.exit(1);
}

const entries = Array.isArray(catalog)
  ? catalog
  : catalog && Array.isArray(catalog.prompts)
    ? catalog.prompts
    : null;

if (!entries) {
  console.error(`prompts:check: ${rel(indexPath)} must be an array of prompt entries`);
  process.exit(1);
}

const seen = new Map();
for (const entry of entries) {
  if (!entry || typeof entry.id !== "string" || !entry.id) {
    errors.push("catalog has an entry without a valid id");
    continue;
  }
  if (seen.has(entry.id)) {
    errors.push(`duplicate id "${entry.id}"`);
  }
  seen.set(entry.id, entry);

  if (typeof entry.path !== "string" || !entry.path) {
    errors.push(`"${entry.id}": catalog entry is missing a path`);
    continue;
  }
  const full = path.join(promptsRoot, entry.path);
  if (!fs.existsSync(full)) {
    errors.push(`"${entry.id}": path does not exist: ${entry.path}`);
    continue;
  }
  const { data } = parseFrontmatter(fs.readFileSync(full, "utf8"));
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data) || data[field] === "") {
      errors.push(`"${entry.id}" (${entry.path}): frontmatter missing "${field}"`);
    }
  }
  if (data.id && data.id !== entry.id) {
    errors.push(`"${entry.id}": frontmatter id "${data.id}" does not match catalog id`);
  }
  if (data.status && entry.status && data.status !== entry.status) {
    errors.push(`"${entry.id}": status mismatch catalog="${entry.status}" frontmatter="${data.status}"`);
  }
}

const registered = new Set(
  entries.filter((e) => e && typeof e.path === "string").map((e) => path.normalize(e.path)),
);
const present = walk(promptsRoot)
  .filter((p) => path.basename(p) !== "README.md")
  .map((p) => path.relative(promptsRoot, p));
for (const file of present) {
  if (!registered.has(path.normalize(file))) {
    errors.push(`unregistered prompt file: ${file}`);
  }
}

if (errors.length) {
  console.error(`prompts:check: ${errors.length} problem(s):`);
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`prompts:check: OK (${entries.length} prompts)`);
