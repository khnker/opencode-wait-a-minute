#!/usr/bin/env node
/**
 * scripts/run-tests.mjs — deterministic recursive test runner.
 *
 * Discovers all *.test.mjs files (ignoring node_modules, .git, dist, build,
 * coverage, .opencode, .openspec, audit artifacts), explicitly includes
 * wait-a-minute-test.mjs, sorts paths, runs them sequentially via
 * node --test --test-concurrency=1, and prints a summary.
 *
 * Exits non-zero if no suites are found or any suite fails.
 *
 * Output is streamed live (never buffered until exit) so that an abrupt child
 * exit — which discards buffered stdout — still leaves a complete trail.
 *
 * Diagnostic modes:
 *   WAM_TEST_PER_FILE=1  run every suite in its own `node --test` process,
 *                        printing `[run-tests] FILE: <path>` before each, so an
 *                        abrupt exit identifies the culprit file.
 *   WAM_TEST_LOG=<path>  tee markers and child stdout/stderr to a file so the
 *                        trail survives log truncation (CI artifact).
 *
 * Exports `collectTests(root)` so tests/test-discovery.test.mjs can verify
 * the recursive discovery contract without spawning the runner.
 */

import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".opencode",
  ".openspec",
]);

let logStream = null;
function openLogStream() {
  const target = process.env.WAM_TEST_LOG;
  if (!target) return null;
  if (!logStream) logStream = fs.createWriteStream(target, { flags: "a" });
  return logStream;
}

function logLine(line) {
  process.stdout.write(line + "\n");
  const s = openLogStream();
  if (s) s.write(line + "\n");
}

function tee(target, chunk) {
  target.write(chunk);
  const s = openLogStream();
  if (s) s.write(chunk);
}

/**
 * Recursively collect *.test.mjs files under root, excluding IGNORE_DIRS.
 * @param {string} dir
 * @returns {string[]} absolute paths (order is depth-first, lex within dir)
 */
export function collectTests(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      out.push(...collectTests(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

/**
 * Run `node --test` over the given files with live (streamed) output.
 * Resolves to the child's exit code (or 1 on signal/error/timeout).
 */
function runNodeTestStreamed(files) {
  return new Promise((resolve) => {
    const timeout = Number(process.env.WAM_TEST_TIMEOUT_MS || 240000);
    const args = ["--test", "--test-concurrency=1", ...files];
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`[run-tests] ERROR: Test suite execution timed out after ${timeout}ms`);
      child.kill("SIGKILL");
    }, timeout);

    child.stdout.on("data", (chunk) => tee(process.stdout, chunk));
    child.stderr.on("data", (chunk) => tee(process.stderr, chunk));

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[run-tests] ERROR: Spawn failed: code=${err.code}, message=${err.message}`);
      resolve(1);
    });

    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      if (signal && !timedOut) {
        console.error(`[run-tests] ERROR: Child process terminated via signal: ${signal} (exit code: ${code ?? "null"})`);
      }
      resolve(code ?? 1);
    });
  });
}

/**
 * Diagnostic: run each suite in its own process with a marker before it.
 * The last marker printed before an abrupt exit names the culprit file.
 */
async function runPerFile(files) {
  const failures = [];
  for (const f of files) {
    logLine(`[run-tests] FILE: ${rel(f)}`);
    const code = await runNodeTestStreamed([f]);
    if (code !== 0) {
      failures.push({ file: rel(f), code });
      logLine(`[run-tests] FAIL: ${rel(f)} (exit ${code})`);
    }
  }
  if (failures.length > 0) {
    logLine(`[run-tests] ${failures.length}/${files.length} suites failed:`);
    for (const { file, code } of failures) logLine(`  - ${file} (exit ${code})`);
    return 1;
  }
  logLine(`[run-tests] all ${files.length} suites passed (per-file mode)`);
  return 0;
}

function runLegacy(files) {
  // wait-a-minute-test.mjs is the legacy monolithic suite. The new runner
  // already discovers it recursively, so this path is reserved for explicit
  // `npm run test:legacy`.
  const args = ["--test", "--test-concurrency=1", ...files];
  const res = spawnSync(process.execPath, args, { stdio: "inherit" });
  return res.status ?? 1;
}

async function main() {
  const isLegacy = process.argv.includes("--legacy");
  const explicit = path.join(ROOT, "tests/legacy/wait-a-minute-test.mjs");
  let discovered = collectTests(ROOT);

  if (!isLegacy) {
    discovered = discovered.filter(f => path.resolve(f) !== explicit);
  }

  const all = new Set(discovered);
  if (isLegacy && fs.existsSync(explicit)) all.add(explicit);

  const files = [...all].sort();
  if (files.length === 0) {
    console.error("[run-tests] no test suites discovered under", ROOT);
    process.exit(2);
  }

  logLine(`[run-tests] discovered ${files.length} suites`);
  for (const f of files) logLine(`  - ${rel(f)}`);

  let status;
  if (isLegacy) {
    status = runLegacy(files);
  } else if (process.env.WAM_TEST_PER_FILE === "1") {
    status = await runPerFile(files);
  } else {
    status = await runNodeTestStreamed(files);
  }

  if (logStream) logStream.end();
  process.exit(status);
}

// Only run main when executed directly. When imported by test-discovery.test.mjs
// we want to access collectTests without side effects.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  main().catch((err) => {
    console.error(`[run-tests] ERROR: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  });
}
