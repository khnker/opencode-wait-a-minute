/**
 * CQE worker — runs the vendored context-query-core engine off the main thread.
 *
 * The vendored engine is fully synchronous inside `async query()`: on the main
 * thread it cannot be preempted, so a timeout never fires and a cold index build
 * blocks the host. In a worker the host stays responsive and `terminate()` is a
 * real abort.
 *
 * Protocol:
 *   in : { type: 'query', id, query, opts }
 *   out: { type: 'ready' } | { type: 'fatal', error }
 *      | { type: 'result', id, ok: true, result }
 *      | { type: 'result', id, ok: false, error }
 */
import { parentPort, workerData } from 'node:worker_threads';
import { createEngine } from '../../vendor/context-query-core/src/index.js';
import { ensureIndex } from '../../vendor/context-query-core/src/index-ops.js';

const repoRoot = workerData?.repoRoot || process.cwd();

let engine = null;
let fatalError = null;

try {
  engine = createEngine({ repoRoot });
  // Warm the catalog here so the first query never pays the index build on the host.
  ensureIndex(repoRoot);
  parentPort.postMessage({ type: 'ready' });
} catch (err) {
  fatalError = err && err.message ? String(err.message) : String(err);
  parentPort.postMessage({ type: 'fatal', error: fatalError });
}

async function handle(msg) {
  if (!msg || msg.type !== 'query') return;
  try {
    if (!engine) throw new Error(`CQE_ENGINE_UNAVAILABLE: ${fatalError || 'worker not initialized'}`);
    const result = await engine.query(msg.query, msg.opts || {});
    parentPort.postMessage({ type: 'result', id: msg.id, ok: true, result });
  } catch (err) {
    parentPort.postMessage({
      type: 'result',
      id: msg.id,
      ok: false,
      error: err && err.message ? String(err.message) : String(err),
    });
  }
}

// Sequential: one query at a time, so a host-side timeout never races two builds.
let chain = Promise.resolve();
parentPort.on('message', (msg) => {
  chain = chain.then(() => handle(msg)).catch(() => {});
});
