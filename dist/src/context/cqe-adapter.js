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

import fs from 'fs';
import { Worker } from 'node:worker_threads';
import { retrieveContext } from './context-retrieval.js';
import { canonicalRoot, validatePath } from './path-validator.js';
import { wamLog, wamWarn, isDebugEnabled } from '../shared/wam-log.js';

const VALID_MODES = new Set(['disabled', 'shadow', 'enabled']);
const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1;
const MAX_TIMEOUT_MS = 30000;
const MAX_ENGINES = 8;

/**
 * Diagnostic logger for CQE failures. Activated only when debug mode is on
 * (WAM_DEBUG=1, WAM_DEBUG=true, or WAM_LOG_LEVEL=debug). Keeps the plugin
 * silent in normal runs while still surfacing interception problems
 * (failed dynamic import, retrieval throws) when investigating.
 */
function cqeDebugWarn(category, message, detail) {
  if (!isDebugEnabled()) return;
  wamWarn(category, message, detail);
}

// ponytail: bounded per-root handle cache (LRU); one worker or inline engine per repo.
const handleCache = new Map();
let workerUnavailable = false;

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
 * Lazily load the vendor CQE entry. The static import is intentionally avoided:
 * the vendor transitively imports `node:sqlite`, which opencode's Bun runtime
 * cannot resolve. A failed dynamic import must degrade to native retrieval
 * instead of preventing the whole plugin from loading.
 *
 * Diagnostic: when debug mode is on, a failed import is logged with the
 * underlying error (and stack when available) so the interception can be
 * inspected without crashing the surrounding plugin.
 */
async function loadCreateEngine() {
  try {
    const mod = await import('../../vendor/context-query-core/src/index.js');
    return mod.createEngine;
  } catch (err) {
    cqeDebugWarn('cqe-adapter.import', 'CQE vendor dynamic import failed; falling back to native retrieval', {
      error: err && err.message ? err.message : String(err),
      code: err && err.code ? err.code : null,
      stack: err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : null,
    });
    throw err;
  }
}

/**
 * Create a repository-scoped CQE engine. No retrieval runs at creation time.
 * @param {{repoRoot?: string, cacheDir?: string, indexDir?: string, budget?: number}} [config]
 */
export async function createCqeEngine(config = {}) {
  const repoRoot = config.repoRoot || config.root || process.cwd();
  const createEngine = await loadCreateEngine();
  return createEngine({
    repoRoot,
    cacheDir: config.cacheDir,
    indexDir: config.indexDir,
    budget: config.budget,
  });
}

function resolveUseWorker(constraints = {}) {
  if (constraints.useWorker === false) return false;
  if (process.env.WAM_CQE_WORKER === '0') return false;
  return !workerUnavailable;
}

function touchHandle(key, handle) {
  // LRU: re-insert on use so the hottest root sits at the end of the Map.
  handleCache.delete(key);
  handleCache.set(key, handle);
}

function storeHandle(key, handle) {
  touchHandle(key, handle);
  while (handleCache.size > MAX_ENGINES) {
    const [oldKey, old] = handleCache.entries().next().value;
    handleCache.delete(oldKey);
    if (old.kind === 'worker') old.worker.terminate();
  }
}

function getInlineHandle(repoRoot) {
  const key = canonicalRoot(repoRoot || process.cwd()) || process.cwd();
  const existing = handleCache.get(key);
  if (existing && existing.kind === 'inline') {
    touchHandle(key, existing);
    return existing;
  }
  if (existing) {
    handleCache.delete(key);
    if (existing.kind === 'worker') existing.worker.terminate();
  }
  const handle = { kind: 'inline', key, enginePromise: createCqeEngine({ repoRoot: key }) };
  handle.enginePromise.catch(() => {
    if (handleCache.get(key) === handle) handleCache.delete(key);
  });
  storeHandle(key, handle);
  return handle;
}

function getWorkerHandle(repoRoot) {
  const key = canonicalRoot(repoRoot || process.cwd()) || process.cwd();
  const existing = handleCache.get(key);
  if (existing && existing.kind === 'worker') {
    touchHandle(key, existing);
    return existing;
  }
  if (existing) handleCache.delete(key);

  let worker;
  try {
    const workerOpts = { workerData: { repoRoot: key } };
    // --input-type only applies to `node -e`; inheriting it breaks file workers.
    if (process.execArgv.some((arg) => arg.startsWith('--input-type'))) {
      workerOpts.execArgv = process.execArgv.filter((arg) => !arg.startsWith('--input-type'));
    }
    worker = new Worker(new URL('./cqe-worker.mjs', import.meta.url), workerOpts);
  } catch (err) {
    // Fail soft: keep serving inline for the rest of the process.
    workerUnavailable = true;
    cqeDebugWarn('cqe-adapter.worker', 'worker spawn failed; using inline CQE', {
      error: err && err.message ? err.message : String(err),
    });
    return null;
  }

  // An idle worker must never keep the host process (CLI/script) alive; queries
  // ref() it for the duration of the in-flight request (see sendWorkerQuery).
  worker.unref();

  const handle = {
    kind: 'worker',
    key,
    worker,
    ready: false,
    busy: false,
    seq: 0,
    warmingTimedOut: false,
    readyPromise: null,
  };
  handle.readyPromise = new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (handleCache.get(key) === handle) handleCache.delete(key);
      if (!settled) {
        settled = true;
        reject(err);
      }
    };
    worker.on('message', (msg) => {
      if (!msg) return;
      if (msg.type === 'ready') {
        handle.ready = true;
        if (!settled) {
          settled = true;
          resolve();
        }
      } else if (msg.type === 'fatal') {
        if (handleCache.get(key) === handle) handleCache.delete(key);
        try { worker.terminate(); } catch { /* best-effort */ }
        if (!settled) {
          settled = true;
          reject(new Error(`CQE_WORKER_FATAL: ${msg.error}`));
        }
      }
    });
    worker.on('error', (err) => fail(err));
    worker.on('exit', (code) => fail(new Error(`CQE_WORKER_EXIT: ${code}`)));
  });
  // Queries attach later; swallow early rejections so a cold-start crash is not unhandled.
  handle.readyPromise.catch(() => {});
  storeHandle(key, handle);
  return handle;
}

/**
 * Post a query and resolve/reject on its matching result. Returns the cleanup
 * so a timeout can detach listeners instead of leaking them until exit.
 */
function sendWorkerQuery(handle, queryText, constraints) {
  const id = ++handle.seq;
  let cleanup;
  const promise = new Promise((resolve, reject) => {
    const onMessage = (msg) => {
      if (!msg || msg.type !== 'result' || msg.id !== id) return;
      cleanup();
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error || 'CQE_WORKER_QUERY_FAILED'));
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`CQE_WORKER_EXIT: ${code}`));
    };
    cleanup = () => {
      handle.worker.off('message', onMessage);
      handle.worker.off('error', onError);
      handle.worker.off('exit', onExit);
      handle.worker.unref();
    };
    handle.worker.on('message', onMessage);
    handle.worker.on('error', onError);
    handle.worker.on('exit', onExit);
  });
  // Keep the loop alive only while this request is pending.
  handle.worker.ref();
  handle.worker.postMessage({
    type: 'query',
    id,
    query: queryText,
    opts: { limit: constraints.maxResults, scope: constraints.scope },
  });
  return { promise, cleanup };
}

function timeoutError(timeoutMs) {
  return new Error(`CQE_TIMEOUT after ${timeoutMs}ms`);
}

/**
 * Run one query on a ready worker. On timeout the worker is terminated: the
 * vendored engine cannot be interrupted from the host any other way.
 */
async function queryWorker(handle, queryText, constraints, timeoutMs) {
  const { promise, cleanup } = sendWorkerQuery(handle, queryText, constraints);
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
    });
    return await Promise.race([promise, timeout]);
  } catch (err) {
    cleanup();
    if (err && /CQE_TIMEOUT/.test(err.message)) {
      handle.worker.terminate();
      if (handleCache.get(handle.key) === handle) handleCache.delete(handle.key);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function resolveTimeout(explicit) {
  let ms = Number(explicit);
  if (explicit == null || explicit === '' || !Number.isFinite(ms)) {
    const env = process.env.WAM_CQE_TIMEOUT_MS;
    const envMs = Number(env);
    ms = env != null && env !== '' && Number.isFinite(envMs) ? envMs : DEFAULT_TIMEOUT_MS;
  }
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, ms));
}

function withTimeout(promise, timeoutMs) {
  // Inline path only. The vendored engine is synchronous inside query(), so this
  // races a timer against an already-blocking call: it discards the late result
  // but cannot preempt the work. The worker path uses terminate() for a real abort.
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
  const abs = validatePath(item.path, repoRoot || process.cwd());
  if (!abs) return item;
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
  const repoRoot = canonicalRoot(constraints.repoRoot || constraints.root || process.cwd()) || process.cwd();
  const startTime = Date.now();
  let cqeResult = null;
  let cqeError = null;
  let timedOut = false;
  let fallbackReason = null;
  let usedWorker = false;

  if (mode !== 'disabled' && queryText != null && String(queryText).trim() !== '') {
    try {
      if (!fs.existsSync(repoRoot)) throw new Error(`CQE_ROOT_NOT_FOUND: ${repoRoot}`);
      const timeoutMs = resolveTimeout(constraints.timeoutMs);
      const workerHandle = resolveUseWorker(constraints) ? getWorkerHandle(repoRoot) : null;
      if (workerHandle) {
        usedWorker = true;
        if (workerHandle.busy) {
          // A concurrent prompt owns the worker: never queue, fall back now.
          fallbackReason = 'busy';
        } else if (workerHandle.warmingTimedOut && !workerHandle.ready) {
          fallbackReason = 'warming';
        } else {
          workerHandle.busy = true;
          try {
            if (!workerHandle.ready) {
              let timer;
              try {
                await Promise.race([
                  workerHandle.readyPromise,
                  new Promise((_, reject) => {
                    timer = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
                  }),
                ]);
              } catch (err) {
                // Still building: let it finish off-thread, just stop waiting on it.
                if (err && /CQE_TIMEOUT/.test(err.message)) workerHandle.warmingTimedOut = true;
                throw err;
              } finally {
                clearTimeout(timer);
              }
            }
            cqeResult = await queryWorker(workerHandle, queryText, constraints, timeoutMs);
          } finally {
            workerHandle.busy = false;
          }
        }
      } else {
        const handle = getInlineHandle(repoRoot);
        const engine = await handle.enginePromise;
        if (!engine) throw new Error('CQE_ENGINE_UNAVAILABLE');
        cqeResult = await withTimeout(
          engine.query(queryText, {
            budget: constraints.budget,
            limit: constraints.maxResults,
            scope: constraints.scope,
          }),
          timeoutMs
        );
      }
    } catch (err) {
      cqeError = err;
      timedOut = err && /CQE_TIMEOUT/.test(err.message);
      wamLog('cqe-adapter', 'CQE query failed', {
        query: queryText,
        mode,
        timeout: timedOut,
        error: err && err.message,
      });
      cqeDebugWarn('cqe-adapter.retrieve', 'CQE execution failed; falling back to native retrieval', {
        query: queryText,
        mode,
        timedOut,
        error: err && err.message ? err.message : String(err),
        code: err && err.code ? err.code : null,
        stack: err && err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : null,
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
    repoRoot,
    worker: usedWorker,
    empty: false,
    timedOut,
    cqeError: cqeError ? cqeError.message : null,
    nativeTotalItems: nativeResult.total,
  };

  const rawResults = (cqeResult && Array.isArray(cqeResult.results)) ? cqeResult.results : [];
  const normalized = dedupe(
    rawResults.map((r, i) => normalizeItem(r, i, queryText, elapsedMs))
  ).map(it => materializeSnippet(it, repoRoot));

  if (mode === 'shadow') {
    wamLog('cqe-adapter', 'Shadow comparison', {
      query: queryText,
      nativeCount: nativeResult.items.length,
      cqeCount: normalized.length,
      cqeError: metadata.cqeError,
      elapsedMs,
      timedOut,
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
        metadata: { ...metadata, totalItems: nativeResult.total, empty: fallbackReason == null, fallbackReason: fallbackReason || 'empty' },
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
  const shadowFailed = mode === 'shadow' && Boolean(cqeError);
  const shadowEmpty = mode === 'shadow' && !cqeError && normalized.length === 0;
  return {
    ...nativeResult,
    source: 'wam-native',
    cqeResult,
    cqeError: metadata.cqeError,
    fallbackUsed: shadowFailed,
    metadata: {
      ...metadata,
      totalItems: nativeResult.total,
      ...(shadowFailed ? { fallbackReason: 'error' } : {}),
      ...(shadowEmpty ? { fallbackReason: 'empty', empty: true } : {}),
    },
  };
}
