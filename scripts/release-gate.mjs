#!/usr/bin/env node
/**
 * Robust RC1 Release Gate Runner
 *
 * Enforces strict verification criteria and structured status codes:
 *   - PASS: Gate completed successfully
 *   - FAIL: Gate execution failed or assertion failed
 *   - SKIP: Gate skipped (only valid for optional gates)
 *   - NOT_CONFIGURED: Required credentials/runtime missing (treated as BLOCKED/FAIL for mandatory checks)
 *
 * Exits 0 only if all required gates PASS. Exits 1 otherwise.
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const GATES = [
  {
    name: "Version Parity",
    cmd: "node scripts/verify-version-parity.mjs",
    required: true,
  },
  {
    name: "Package Integrity",
    cmd: "node scripts/verify-package.mjs",
    required: true,
  },
  {
    name: "Security Audit",
    cmd: "node scripts/verify-security.mjs",
    required: true,
  },
  {
    name: "Migration & Isolation E2E",
    cmd: "node tests/e2e/migration/run.mjs && node tests/isolation/run.mjs",
    required: true,
  },
  {
    name: "OpenCode Smoke E2E",
    cmd: "node tests/e2e/opencode/smoke.mjs",
    required: true,
  },
  {
    name: "Performance Sanity",
    cmd: "node scripts/performance-sanity.mjs",
    required: false,
  },
];

console.log("==================================================");
console.log("WAM RC1 UNIFIED RELEASE GATE");
console.log("==================================================");

let failedCount = 0;
const results = [];
const startTime = Date.now();

for (const gate of GATES) {
  const gateStart = Date.now();
  process.stdout.write(`[${gate.name}] ... `);
  try {
    execSync(gate.cmd, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      encoding: "utf8",
      timeout: 120000,
    });
    const duration = Date.now() - gateStart;
    console.log(`PASS (${duration}ms)`);
    results.push({ name: gate.name, status: "PASS", duration });
  } catch (e) {
    const duration = Date.now() - gateStart;
    console.log(`FAIL (${duration}ms)`);
    if (gate.required) {
      failedCount++;
    }
    results.push({ name: gate.name, status: gate.required ? "FAIL" : "WARN", duration, error: e.message });
  }
}

const totalDuration = Date.now() - startTime;
console.log("==================================================");
if (failedCount === 0) {
  console.log(`RC1 READY (${totalDuration}ms)`);
  process.exit(0);
} else {
  console.log(`RC1 BLOCKED — ${failedCount} required gate(s) failed (${totalDuration}ms)`);
  process.exit(1);
}
