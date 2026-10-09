/**
 * WAM CQE Adapter — integration of context-query-core into WAM context retrieval.
 *
 * Modes:
 *   - disabled: native WAM retrieval only (safe default).
 *   - shadow:   run CQE for comparison, but return native context to the agent.
 *   - enabled:  use CQE results when available, fall back to native on error/empty.
 *
 * Guarantees:
 *   - Never transitions task state; CQE success != verification.
 *   - Empty results are distinguishable from execution errors.
 *   - Every result keeps provenance (operator, query, source, elapsed).
 *   - Repository is explicit; never relies on an accidental process.cwd().
 */

import { createEngine } from 'context-query-core';
import { retrieveContext } from './context-retrieval.js';
import { wamLog } from '../shared/wam-log.js';

const VALID_MODES = new Set(['disabled', 'shadow', 'enabled']);

let defaultEngine = null;
let defaultEngineKey = null;

function resolveMode(explicit) {
  const raw = explicit || process.env.WAM_CQE_MODE || (process.env.WAM_CQE === '1' ? 'enabled' : 'disabled');
  const mode = String(raw).toLowerCase();
  return VALID_MODES.has(mode) ? mode : 'disabled';
}

/**
 * Create a repository-scoped CQE engine. No retrieval runs at creation time.
 * @param {{repoRoot?: string, cacheDir?: string, indexDir?: string, budget?: number}} [config]
 */
export function createCqeEngine(config = {}) {
  const repoRoot = config.repoRoot || config.root || process.cwd();
  const engine = createEngine({
    repoRoot,
    cacheDir: config.cacheDir,
    indexDir: config.indexDir,
    budget: config.budget,
  });
  return {
    repoRoot: engine.repoRoot,
    cacheDir: engine.cacheDir,
    indexDir: engine.indexDir,
    budget: engine.budget,
    query: (text, opts = {}) => engine.query(text, opts),
    clearCache: () => engine.clearCache(),
    dispose: () => engine.dispose(),
  };
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
  return {
    id: raw.id || `${raw.path || raw.file || 'unknown'}:${raw.startLine ?? raw.line ?? idx}`,
    path: raw.path || raw.file || '',
    content: raw.snippet || raw.content || '',
    startLine: raw.startLine ?? raw.line ?? null,
    endLine: raw.endLine ?? null,
    score: raw.score ?? raw.relevance ?? null,
    evidenceType: raw.type || raw.evidenceType || 'retrieval',
    provenance: {
      operator: raw.operator || 'cqe-retrieval',
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
  const normalized = dedupe(rawResults.map((r, i) => normalizeItem(r, i, queryText, elapsedMs)));

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
