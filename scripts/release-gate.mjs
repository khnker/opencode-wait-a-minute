#!/usr/bin/env node
/**
 * Robust RC1 Release Gate Runner
 *
 * Enforces strict verification criteria and structured status codes:
 *   - PASS: Gate completed successfully
 *   - FAIL: Gate execution failed or assertion failed
 *   - SKIP: Gate skipped (only valid for optional gates)
 *
 * Contract:
 *   0: All required gates PASS.
 *   2: Required gates PASS, but one or more optional gates were UNAVAILABLE.
 *   1: One or more required gates FAILED.
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const UNAVAILABLE_EXIT_CODE = 2;

const GATES = [
  { name: "Version Parity", cmd: "node scripts/verify-version-parity.mjs", required: true },
  { name: "Test Suite", cmd: "npm test", required: true, timeout: 180000 },
  { name: "Package Integrity", cmd: "node scripts/verify-package.mjs", required: true },
  { name: "Security Audit", cmd: "node scripts/verify-security.mjs", required: true },
  { name: "Migration E2E", cmd: "node tests/e2e/migration/run.mjs", required: true },
  { name: "Isolation E2E", cmd: "node tests/isolation/run.mjs", required: true },
  { name: "OpenCode Smoke E2E", cmd: "node tests/e2e/opencode/smoke.mjs", required: true },
  { name: "Package E2E", cmd: "npm run test:e2e:package", required: true },
  { name: "Performance Sanity", cmd: "node scripts/performance-sanity.mjs", required: false },
  ...(process.env.WAM_RC1_EVIDENCE === "1"
    ? [{ name: "Real Benchmark (RC1 evidence)", cmd: "npm run benchmark:real", required: true }]
    : []),
];

  console.log("==================================================");
  console.log("WAM RC1 UNIFIED RELEASE GATE");
  console.log("==================================================");

let failedCount = 0;
let skippedCount = 0;
const results = [];
const startTime = Date.now();

for (const gate of GATES) {
  const gateStart = Date.now();
  process.stdout.write(`  [${gate.name}] ... `);
  
  let status = "PASS";
  try {
    execSync(gate.cmd, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      encoding: "utf8",
      timeout: gate.timeout ?? 120000,
    });
  } catch (e) {
    const code = typeof e?.status === "number" ? e.status : null;
    if (gate.required) {
      status = "FAIL";
    } else if (code === UNAVAILABLE_EXIT_CODE) {
      status = "SKIP";
    } else {
      status = "FAIL";
    }
  }

  const duration = Date.now() - gateStart;
  console.log(`${status} (${duration}ms)`);
  
  if (status === "FAIL") failedCount++;
  if (status === "SKIP") skippedCount++;
  results.push({ name: gate.name, status, duration });
}

const totalDuration = Date.now() - startTime;
console.log("==================================================");
results.forEach(r => console.log(`  ${r.status.padEnd(4)} ${r.name}`));
console.log("==================================================");

const verdict = failedCount === 0 ? "READY" : "BLOCKED";
const exitCode = failedCount === 0 ? (skippedCount > 0 ? UNAVAILABLE_EXIT_CODE : 0) : 1;
const blockers = results.filter((r) => r.status === "FAIL").map((r) => r.name);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ verdict, exitCode, totalDuration, skipped: skippedCount, gates: results, blockers }));
}

if (failedCount === 0) {
  console.log(`RC1 READY (${totalDuration}ms, ${skippedCount} skipped)`);
  process.exit(skippedCount > 0 ? UNAVAILABLE_EXIT_CODE : 0);
} else {
  console.log(`RC1 BLOCKED — ${failedCount} gate(s) failed (${totalDuration}ms)`);
  process.exit(1);
}
