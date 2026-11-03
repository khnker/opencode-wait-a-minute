#!/usr/bin/env node
/**
 * engine/index-ops.js — access paths sobre el Repository Index Layer (context-query-ir).
 * ensureIndex(cwd): construye el catálogo una vez por repo (memo) si falta.
 * Wrappers: symbol-lookup / lexical-index / dependency-expand → rows de evidencia
 * tipada {source, path, line_start, line_end, match_type, score, certainty, token_estimate}.
 * Fallback: catálogo ausente/roto → null (el caller decide: rg o construir).
 */
import path from 'node:path';
import fs from 'node:fs';
import { buildIndex, freshness, queryIndex, catalogPathFor } from './index-layer/index.js';

const RECONCILE_TTL_MS = 5000;
const built = new Map(); // cwd → last reconcile timestamp (ms)

function safeQueryIndex(cwd, type, name, limit) {
  try {
    return queryIndex(cwd, type, name, limit);
  } catch {
    // Catálogo ausente/roto (p.ej. node:sqlite no disponible en este runtime)
    // → [] para que el caller degrade a rg/filesystem en vez de reventar el plan.
    return [];
  }
}

export function ensureIndex(cwd, { forceBuild = false, ttlMs } = {}) {
  const key = path.resolve(cwd);
  const now = Date.now();
  const ttl = ttlMs ?? Number(process.env.CF_INDEX_TTL_MS ?? RECONCILE_TTL_MS);
  const last = built.get(key);
  if (!forceBuild && last !== undefined && now - last < ttl) return 2; // 2 = reuse

  const dbPath = catalogPathFor(key);
  try {
    if (!fs.existsSync(dbPath)) {
      buildIndex(key);
      built.set(key, now);
      return 1; // 1 = build
    }
    // The catalog is cached on disk. Without this check, files edited after
    // the first build stay invisible (or keep stale line numbers) forever.
    const fresh = freshness(key);
    if (forceBuild || fresh.changed_paths?.length) buildIndex(key);
    built.set(key, now);
    return 2;
  } catch {
    return 0; // 0 = fallback rg
  }
}

export function symbolLookup(cwd, name, limit = 10) {
  const rows = safeQueryIndex(cwd, 'symbol', name, limit);
  return rows.map((r) => ({
    source: 'index-symbol', path: r.path, line_start: r.span?.start ?? 1, line_end: r.span?.end ?? 1,
    content: '', match_type: 'structural', score: 1, certainty: r.certainty,
    index_version: r.index_version, token_estimate: 12,
  }));
}

export function lexicalLookup(cwd, name, limit = 10) {
  const rows = safeQueryIndex(cwd, 'lexical', name, limit);
  return rows.map((r) => ({
    source: 'index-lexical', path: r.path, line_start: 1, line_end: 1,
    content: '', match_type: 'exact', score: 0.9, certainty: r.certainty,
    index_version: r.index_version, token_estimate: 10,
  }));
}

export function dependencyExpand(cwd, name, limit = 10) {
  const rows = safeQueryIndex(cwd, 'dependency', name, limit);
  return rows.map((r) => ({
    source: 'index-dependency', path: r.path, line_start: 1, line_end: 1,
    content: '', match_type: 'reference', score: 0.9, certainty: r.certainty,
    index_version: r.index_version, token_estimate: 10,
  }));
}