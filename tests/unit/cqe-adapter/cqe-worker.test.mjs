/**
 * Worker runtime regression tests.
 *
 * The vendored CQE engine is synchronous inside `async query()`. On the main
 * thread a Promise.race timeout is inert; in a worker, terminate() is a real
 * abort. The 1ms test is the regression: it stays red if the timeout is inert.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { retrieveWithCqe } from '../../../src/context/cqe-adapter.js';

process.env.WAM_LOGGING = 'false';
process.env.WAM_LOG_FILE = path.join(os.tmpdir(), `wam-cqe-worker-${process.pid}.log`);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, '../../fixtures/cqe/sample-repo');
const QUERY = 'FIND definitions OF symbol parseConfig';

test('worker round-trip returns CQE items', async () => {
  const r = await retrieveWithCqe(QUERY, {
    repoRoot: SAMPLE,
    mode: 'enabled',
    useWorker: true,
    timeoutMs: 20000,
  });

  assert.strictEqual(r.source, 'cqe');
  assert.ok(r.items.length > 0, 'expected at least one CQE item');
  assert.strictEqual(r.metadata.worker, true);
});

test('1ms timeout is a real abort on the worker path', async () => {
  const r = await retrieveWithCqe(QUERY, {
    repoRoot: SAMPLE,
    mode: 'enabled',
    useWorker: true,
    timeoutMs: 1,
  });

  assert.strictEqual(r.source, 'wam-native');
  assert.strictEqual(r.metadata.timedOut, true);
  assert.match(r.metadata.cqeError, /CQE_TIMEOUT/);
});

test('inline fallback still works with useWorker:false', async () => {
  const r = await retrieveWithCqe(QUERY, {
    repoRoot: SAMPLE,
    mode: 'enabled',
    useWorker: false,
    timeoutMs: 20000,
  });

  assert.strictEqual(r.source, 'cqe');
  assert.ok(r.items.length > 0);
  assert.strictEqual(r.metadata.worker, false);
});

test('concurrent queries never queue on a busy worker', async () => {
  const opts = {
    repoRoot: SAMPLE,
    mode: 'enabled',
    useWorker: true,
    timeoutMs: 20000,
  };
  const settled = await Promise.allSettled([
    retrieveWithCqe(QUERY, opts),
    retrieveWithCqe(QUERY, opts),
  ]);

  assert.strictEqual(settled.length, 2);
  const fulfilled = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  assert.ok(fulfilled.length >= 1, 'at least one query must resolve');
  const cqe = fulfilled.find((r) => r.source === 'cqe');
  assert.ok(cqe, 'one query should use the worker');
  const busy = fulfilled.find((r) => r.metadata.fallbackReason === 'busy');
  assert.ok(busy || fulfilled.length === 2);
});

// Regression: an idle worker must not hold the host event loop open. A plain
// script that awaits a query and logs must then exit on its own (no --test).
test('a plain node script exits after a CQE query', async () => {
  const script =
    "import{retrieveWithCqe}from'./src/context/cqe-adapter.js';" +
    " const r=await retrieveWithCqe('WHERE is validatePath defined'," +
    "{repoRoot:process.cwd(),mode:'enabled',timeoutMs:1500});" +
    " console.log('CHILD_OK source='+r.source);";
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d;
  });
  child.stderr.on('data', (d) => {
    stderr += d;
  });

  const LIMIT_MS = 20000;
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`child did not exit in ${LIMIT_MS}ms\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, LIMIT_MS);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  assert.strictEqual(exitCode, 0, `child exited ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  assert.match(stdout, /CHILD_OK/);
});
