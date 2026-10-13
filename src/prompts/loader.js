import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;

let catalogCache = null;
let catalogRoot = null;
const fileCache = new Map();

function defaultRoot() {
  return fileURLToPath(new URL("../../prompts/", import.meta.url));
}

function resolveRoot(opts) {
  return opts && opts.root ? opts.root : defaultRoot();
}

export function parseFrontmatter(text) {
  const normalized = String(text).replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);
  if (lines[0] === undefined || lines[0].trim() !== "---") {
    return { data: {}, body: normalized };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { data: {}, body: normalized };
  }
  const data = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      const inner = rawValue.slice(1, -1).trim();
      data[key] = inner
        ? inner
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter(Boolean)
        : [];
    } else {
      data[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
  let body = lines.slice(end + 1).join("\n");
  if (body.endsWith("\n")) body = body.slice(0, -1);
  return { data, body };
}

function loadCatalog(root) {
  if (catalogCache && catalogRoot === root) return catalogCache;
  const indexPath = path.join(root, "index.json");
  let raw;
  try {
    raw = fs.readFileSync(indexPath, "utf8");
  } catch (e) {
    throw new Error(`prompts: cannot read catalog "${indexPath}": ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`prompts: malformed catalog "${indexPath}": ${e.message}`);
  }
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && Array.isArray(parsed.prompts)
      ? parsed.prompts
      : null;
  if (!entries) {
    throw new Error(`prompts: catalog "${indexPath}" must be an array of prompt entries`);
  }
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id) {
      throw new Error(`prompts: catalog "${indexPath}" has an entry without a valid id`);
    }
    if (typeof entry.path !== "string" || !entry.path) {
      throw new Error(`prompts: catalog entry "${entry.id}" is missing a path`);
    }
  }
  catalogCache = entries;
  catalogRoot = root;
  return entries;
}

function readPromptBody(root, entry) {
  const filePath = path.isAbsolute(entry.path) ? entry.path : path.join(root, entry.path);
  if (fileCache.has(filePath)) return fileCache.get(filePath);
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    throw new Error(`prompts: cannot read prompt "${entry.id}" at "${filePath}": ${e.message}`);
  }
  const { body } = parseFrontmatter(text);
  fileCache.set(filePath, body);
  return body;
}

export function loadPrompt(id, vars = {}, opts = {}) {
  if (typeof id !== "string" || !id) {
    throw new Error(`prompts: loadPrompt requires a non-empty string id (received ${JSON.stringify(id)})`);
  }
  const root = resolveRoot(opts);
  const catalog = loadCatalog(root);
  const entry = catalog.find((e) => e.id === id);
  if (!entry) {
    throw new Error(`prompts: unknown prompt id "${id}" (root "${root}")`);
  }
  const body = readPromptBody(root, entry);
  const supplied = vars || {};
  return body.replace(PLACEHOLDER, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(supplied, name)) {
      throw new Error(`prompts: prompt "${id}" requires variable "${name}" but none was supplied`);
    }
    const value = supplied[name];
    return value === undefined ? "undefined" : String(value);
  });
}

export function listPrompts(opts = {}) {
  const root = resolveRoot(opts);
  return loadCatalog(root).slice();
}

export function clearCache() {
  catalogCache = null;
  catalogRoot = null;
  fileCache.clear();
}
