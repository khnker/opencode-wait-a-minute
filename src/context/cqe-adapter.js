/**
 * WAM CQE Adapter — integration of context-query-core into WAM context retrieval.
 *
 * Modes:
 *   - disabled: native WAM retrieval only (set via env or explicit mode).
 *   - shadow:   run CQE for comparison, but return native context to the agent.
 *   - enabled:  use CQE results when available, fall back to native on error/empty.
 *
 * Default: enabled (CQE is on by default; set WAM_CQE_MODE=disabled to opt out).
 *
 * Guarantees:
 *   - Never transitions task state; CQE success != verification.
 *   - Empty results are distinguishable from execution errors.
 *   - Every result keeps provenance (operator, query, source, elapsed).
 *   - Repository is explicit; never relies on an accidental process.cwd().
 */

import { createEngine } from 'context-query-core';
import fs from 'fs';
import path from 'path';
import { retrieveContext } from './context-retrieval.js';
import { wamLog } from '../shared/wam-log.js';

const VALID_MODES = new Set(['disabled', 'shadow', 'enabled']);

let defaultEngine = null;
let defaultEngineKey = null;

function resolveMode(explicit) {
  if (explicit != null && explicit !== '') {
    const mode = String(explicit).toLowerCase();
    return VALID_MODES.has(mode) ? mode : 'disabled';
  }
  const env = process.env.WAM_CQE_MODE;
  if (env != null && env !== '') {
    const mode = String(env).toLowerCase();
    return VALID_MODES.has(mode) ? mode : 'disabled';
  }
  if (process.env.WAM_CQE === '0' || process.env.WAM_CQE === 'false') {
    return 'disabled';
  }
  return 'enabled';
}

/**
 * Create a repository-scoped CQE engine. No retrieval runs at creation time.
 * @param {{repoRoot?: string, cacheDir?: string, indexDir?: string, budget?: number}} [config]
 */
export function createCqeEngine(config = {}) {
  const repoRoot = config.repoRoot || config.root || process.cwd();
  return createEngine({
    repoRoot,
    cacheDir: config.cacheDir,
    indexDir: config.indexDir,
    budget: config.budget,
  });
}

function getDefaultEngine(repoRoot) {
  const root = repoRoot || process.cwd();
  if (!defaultEngine || defaultEngineKey !== root) {
    defaultEngine = createCqeEngine({ repoRoot: root });
    defaultEngineKey = root;
  }
  return defaultEngine;
}

function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`CQE_TIMEOUT after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function normalizeItem(raw, idx, queryText, elapsedMs) {
  const content = raw.snippet || raw.content || '';
  const startLine = raw.startLine ?? raw.line_start ?? raw.line ?? null;
  const endLine = raw.endLine ?? raw.line_end ?? null;
  const tokenEstimate =
    raw.tokenEstimate ?? raw.token_estimate ?? raw.cost?.tokens ?? Math.ceil(content.length / 4);
  return {
    id: raw.id || raw.evidence_id || `${raw.path || raw.file || 'unknown'}:${startLine ?? idx}`,
    path: raw.path || raw.file || '',
    content,
    startLine,
    endLine,
    score: raw.score ?? raw.score_final ?? raw.relevance ?? null,
    evidenceType: raw.evidenceType || raw.evidence_type || raw.type || 'retrieval',
    tokenEstimate,
    provenance: {
      operator: raw.provenance?.operator || raw.operator || 'cqe-retrieval',
      query: queryText,
      source: 'cqe',
      elapsedMs,
    },
  };
}

export function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = `${it.path}:${it.startLine ?? ''}:${it.endLine ?? ''}:${it.evidenceType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

const MAX_SNIPPET_LINES = 3;

/**
 * Materialize a snippet for evidence items that carry only path + line range.
 * Keeps the injected context bounded (MAX_SNIPPET_LINES) so CQE stays token-cheap.
 * @param {Object} item - Normalized item.
 * @param {string} [repoRoot] - Repository root for resolving relative paths.
 * @returns {Object} Item with `content` and `tokenEstimate` populated when possible.
 */
export function materializeSnippet(item, repoRoot) {
  if (item.content && item.content.trim()) return item;
  if (!item.path) return item;
  const abs = path.isAbsolute(item.path) ? item.path : path.join(repoRoot || process.cwd(), item.path);
  try {
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    const start = Math.max(1, item.startLine ?? 1);
    const end = Math.min(lines.length, item.startLine ? (item.endLine ?? start + MAX_SNIPPET_LINES - 1) : MAX_SNIPPET_LINES);
    const snippet = lines.slice(start - 1, end).join('\n').trim();
    if (!snippet) return item;
    return {
      ...item,
      content: snippet,
      tokenEstimate: Math.max(8, Math.ceil(snippet.length / 4)),
    };
  } catch (e) {
    return item;
  }
}

/**
 * Retrieve context using CQE with WAM fallback, shadow support and budget enforcement.
 *
 * @param {string} queryText
 * @param {Object} [constraints]
 * @param {string} [constraints.repoRoot]  explicit target repository
 * @param {string} [constraints.mode]      disabled | shadow | enabled
 * @param {number} [constraints.maxResults]
 * @param {number} [constraints.budget]    token/result budget hint passed to CQE
 * @param {number} [constraints.timeoutMs]
 * @param {Object} [constraints.registry]  native WAM registry for fallback context
 * @returns {Promise<Object>}
 */
export async function retrieveWithCqe(queryText, constraints = {}) {
  const mode = resolveMode(constraints.mode);
  const startTime = Date.now();
  let cqeResult = null;
  let cqeError = null;
  let timedOut = false;

  if (mode !== 'disabled' && queryText != null) {
    try {
      const engine = getDefaultEngine(constraints.repoRoot);
      cqeResult = await withTimeout(
        engine.query(queryText, {
          budget: constraints.budget,
          limit: constraints.maxResults,
          scope: constraints.scope,
        }),
        constraints.timeoutMs
      );
    } catch (err) {
      cqeError = err;
      timedOut = err && /CQE_TIMEOUT/.test(err.message);
      wamLog('cqe-adapter', 'CQE query failed', {
        query: queryText,
        mode,
        timeout: timedOut,
        error: err && err.message,
      });
    }
  }

  const nativeConstraints = { ...constraints };
  delete nativeConstraints.mode;
  delete nativeConstraints.repoRoot;
  delete nativeConstraints.cacheDir;
  delete nativeConstraints.indexDir;
  delete nativeConstraints.budget;
  delete nativeConstraints.timeoutMs;
  const nativeResult = retrieveContext(queryText, nativeConstraints);
  const elapsedMs = Date.now() - startTime;
  const metadata = {
    mode,
    empty: false,
    timedOut,
    cqeError: cqeError ? cqeError.message : null,
    nativeTotalItems: nativeResult.total,
  };

  const rawResults = (cqeResult && Array.isArray(cqeResult.results)) ? cqeResult.results : [];
  const normalized = dedupe(
    rawResults.map((r, i) => normalizeItem(r, i, queryText, elapsedMs))
  ).map(it => materializeSnippet(it, constraints.repoRoot));

  if (mode === 'shadow') {
    wamLog('cqe-adapter', 'Shadow comparison', {
      query: queryText,
      nativeCount: nativeResult.items.length,
      cqeCount: normalized.length,
      cqeError: metadata.cqeError,
    });
  }

  if (mode === 'enabled') {
    if (cqeError) {
      return {
        ...nativeResult,
        source: 'wam-native',
        cqeResult,
        cqeError: metadata.cqeError,
        fallbackUsed: true,
        metadata: { ...metadata, totalItems: nativeResult.total, fallbackReason: 'error' },
      };
    }
    if (normalized.length === 0) {
      return {
        ...nativeResult,
        source: 'wam-native',
        cqeResult,
        fallbackUsed: true,
        metadata: { ...metadata, totalItems: nativeResult.total, empty: true, fallbackReason: 'empty' },
      };
    }
    const limited = constraints.maxResults > 0 ? normalized.slice(0, constraints.maxResults) : normalized;
    return {
      items: limited,
      total: normalized.length,
      returned: limited.length,
      elapsedMs,
      source: 'cqe',
      cqeResult,
      fallbackUsed: false,
      metadata: { ...metadata, totalItems: normalized.length },
    };
  }

  // disabled or shadow -> native context
  return {
    ...nativeResult,
    source: 'wam-native',
    cqeResult,
    cqeError: metadata.cqeError,
    fallbackUsed: false,
    metadata: { ...metadata, totalItems: nativeResult.total },
  };
}
