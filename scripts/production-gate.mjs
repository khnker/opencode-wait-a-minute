#!/usr/bin/env node
// scripts/production-gate.mjs
/**
 * Production Validation Gate: one-command validation of critical execution scenarios.
 *
 * Executes the full suite of production-critical tests and exits non-zero on any failure.
 * Used by release workflows and CI to assert release readiness.
 */

import { execFileSync } from "node:child_process";

function log(msg) {
  console.log(`[production-gate] ${msg}`);
}

function fail(msg) {
  console.error(`[production-gate] FAIL: ${msg}`);
  process.exit(1);
}

function main() {
  log("running production validation gate...");

  // Run the set of tests marked as production-critical in OpenSpec
  const criticalTests = [
    "plugin-load.test.mjs",
    "strategy-continuity.test.mjs",
    "strategy-continuity-clean.test.mjs",
    "allowed-actions-default.test.mjs",
    "tests/context-output-benchmark.test.mjs", // TASK-08
    "context-benchmark.cwr.test.mjs",    // TASK-10
    "strategy-capabilities.test.mjs",
    "cognition-store.test.mjs",
  ];

  for (const testFile of criticalTests) {
    log(`running ${testFile}...`);
    try {
      execFileSync(
        process.execPath,
        ["--test", testFile],
        { stdio: "inherit", encoding: "utf8" }
      );
      log(`${testFile} ✓`);
    } catch (err) {
      fail(`${testFile} failed:\n${err.message}`);
    }
  }

  log("all production-critical tests passed ✓");
  process.exit(0);
}

main();