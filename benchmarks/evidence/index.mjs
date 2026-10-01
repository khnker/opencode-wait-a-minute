/**
 * Evidence corpus loader.
 *
 * Reads `benchmarks/evidence/sources.json`, JSON-parses it, and validates that
 * every source carries the required keys. Throws on malformed input so a bad
 * corpus can never silently produce an empty report section.
 *
 * Usage:
 *   import { loadEvidenceCorpus } from "./benchmarks/evidence/index.mjs";
 *   const corpus = loadEvidenceCorpus();
 *   const providers = corpus.byType("provider");
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPUS_FILE = "sources.json";
export const EVIDENCE_TYPES = Object.freeze([
  "provider",
  "academic",
  "open-source",
  "independent"
]);

const REQUIRED_SOURCE_KEYS = Object.freeze([
  "id",
  "source",
  "type",
  "date",
  "methodology",
  "metric",
  "population",
  "relevance",
  "limitations"
]);

const REQUIRED_CORPUS_KEYS = Object.freeze(["corpus", "version", "sources"]);

/** Validate a single source object. Returns array of error strings (empty = valid). */
export function validateSource(s) {
  const errors = [];
  if (!s || typeof s !== "object" || Array.isArray(s)) {
    return ["source must be an object"];
  }
  for (const key of REQUIRED_SOURCE_KEYS) {
    const v = s[key];
    if (v === undefined || v === null) {
      errors.push(`missing required key: ${key}`);
    } else if (typeof v !== "string") {
      errors.push(`key ${key} must be a string (got ${typeof v})`);
    } else if (v.trim() === "") {
      errors.push(`key ${key} must be a non-empty string`);
    }
  }
  if (typeof s.type === "string" && !EVIDENCE_TYPES.includes(s.type)) {
    errors.push(`type must be one of ${EVIDENCE_TYPES.join("|")} (got "${s.type}")`);
  }
  return errors;
}

/** Validate the full corpus object. Throws on error. */
export function validateCorpus(corpus) {
  if (!corpus || typeof corpus !== "object" || Array.isArray(corpus)) {
    throw new Error("evidence corpus must be a JSON object");
  }
  for (const key of REQUIRED_CORPUS_KEYS) {
    if (corpus[key] === undefined || corpus[key] === null) {
      throw new Error(`evidence corpus missing required key: ${key}`);
    }
  }
  if (!Array.isArray(corpus.sources)) {
    throw new Error("evidence corpus.sources must be an array");
  }
  if (corpus.sources.length === 0) {
    throw new Error("evidence corpus.sources must not be empty");
  }
  const seen = new Set();
  for (let i = 0; i < corpus.sources.length; i++) {
    const errors = validateSource(corpus.sources[i]);
    if (errors.length) {
      throw new Error(
        `evidence corpus.sources[${i}] invalid:\n  - ${errors.join("\n  - ")}`
      );
    }
    const id = corpus.sources[i].id;
    if (seen.has(id)) {
      throw new Error(`evidence corpus has duplicate source id: ${id}`);
    }
    seen.add(id);
  }
  return true;
}

/**
 * Load and validate the evidence corpus.
 *
 * @param {{root?: string}} [opts] root = directory containing sources.json
 * @returns {{corpus:string, version:string, sources:Array<object>, byType:Function, warnings:string[]}}
 */
export function loadEvidenceCorpus({ root } = {}) {
  const base = root || __dirname;
  const file = path.join(base, CORPUS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`evidence corpus not found: ${file}`);
  }
  const text = fs.readFileSync(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`evidence corpus is not valid JSON (${file}): ${e.message}`);
  }
  validateCorpus(parsed);

  const warnings = [];
  if (typeof parsed.warning === "string") warnings.push(parsed.warning);
  for (const s of parsed.sources) {
    if (s.type === "provider") {
      warnings.push(
        `provider source "${s.id}" describes caching/cost behaviour, NOT WAM context reduction`
      );
    }
  }

  return {
    corpus: parsed.corpus,
    version: parsed.version,
    generatedAt: parsed.generatedAt ?? null,
    taxonomy: parsed.taxonomy ?? EVIDENCE_TYPES,
    warning: parsed.warning ?? null,
    sources: parsed.sources,
    warnings,
    byType(type) {
      if (!EVIDENCE_TYPES.includes(type)) {
        throw new Error(`Unknown evidence type: ${type}. Allowed: ${EVIDENCE_TYPES.join(", ")}`);
      }
      return parsed.sources.filter((s) => s.type === type);
    }
  };
}
