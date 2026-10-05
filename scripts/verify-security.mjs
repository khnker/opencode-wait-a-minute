#!/usr/bin/env node
/**
 * Security and package audit scan for RC1 release.
 *
 * Validates both:
 *   1) npm audit - no high/critical vulnerabilities in production dependencies.
 *   2) Tarball content - no forbidden files.
 *
 * Exit codes:
 *   0 - PASS    (no high/critical vulnerabilities, no forbidden files)
 *   1 - FAIL    (high/critical vulnerabilities or forbidden files present)
 *   2 - BLOCKED (npm audit could not be run or parsed)
 */

import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const REPO_ROOT = resolve(__dirname, "..");

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg) {
  console.error(`[${step}] FAIL: ${msg}`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  try {
    return {
      stdout: execFileSync(cmd, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 60000,
      }),
      error: null,
    };
  } catch (e) {
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || "",
      // Normalize the error to a string once so consumers never read `.message`
      // from an already-stringified error.
      error: e.message || String(e),
    };
  }
}

function emitSecurity(status, reason) {
  const line = `SECURITY: ${status} — ${reason}`;
  if (status === "PASS") {
    console.log(line);
    return;
  }
  console.error(line);
  process.exit(status === "FAIL" ? 1 : 2);
}

function classifyAudit(audit) {
  let report = null;
  const raw = (audit.stdout || "").trim();
  if (raw) {
    try {
      report = JSON.parse(raw);
    } catch {
      report = null;
    }
  }

  if (report && report.metadata && report.metadata.vulnerabilities) {
    const v = report.metadata.vulnerabilities;
    const high = v.high || 0;
    const critical = v.critical || 0;
    if (high > 0 || critical > 0) {
      return {
        status: "FAIL",
        reason: `${high} high, ${critical} critical vulnerabilities`,
      };
    }
    return { status: "PASS", reason: "no high/critical vulnerabilities" };
  }

  if (report && report.error) {
    const err = report.error;
    const detail = err.summary || err.detail || err.code || "unknown audit error";
    return { status: "BLOCKED", reason: `audit error: ${detail}` };
  }

  const detail = audit.error || audit.stderr || "audit produced no parseable report";
  return {
    status: "BLOCKED",
    reason: `audit unavailable: ${String(detail).trim() || "unknown error"}`,
  };
}

// --- npm audit --------------------------------------------------
log("security", "running npm audit (high+ critical)");
const audit = run("npm", ["audit", "--json", "--audit-level=high"], REPO_ROOT);
const { status, reason } = classifyAudit(audit);
emitSecurity(status, reason);

// --- Forbidden file scan in tarball -----------------------------
log("scan", "packing temporary tarball...");
const tsDir = join(tmpdir(), `wam-scan-${Date.now()}`);
mkdirSync(tsDir, { recursive: true });

const pack = run("npm", ["pack", "--pack-destination", tsDir], REPO_ROOT);
if (pack.error) {
  fail("scan", "npm pack failed: " + pack.error);
}
// npm pack writes the .tgz into the destination dir; locate it.
const files = readdirSync(tsDir);
const tgzFile = files.find(f => f.endsWith(".tgz"));
if (!tgzFile) {
  fail("scan", "npm pack produced no tgz file in " + tsDir + "\nstdout: " + pack.stdout + "\nstderr: " + pack.stderr);
}
const packDest = join(tsDir, tgzFile);
log("scan", `packed to ${packDest}`);

log("scan", "listing tarball contents...");
let listOut;
try {
  listOut = execFileSync("tar", ["-tzf", packDest], { cwd: tsDir, encoding: "utf8" });
} catch (e) {
  fail("scan", "failed to list tarball: " + e.message);
}

const entries = listOut.split(/\r?\n/).filter((l) => l.length > 0);
const forbiddenPatterns = [
  /\.env$/,
  /\.(pem|key|p12|der)$/,
  /id_rsa.*/,
  /\.git\//,
  /\.github\//,
  /node_modules\//,
  /\.wam\//,
  /\.swp$/,
  /\.swo$/,
  /\.swap$/,
  /~$/,
];

const found = [];
for (const entry of entries) {
  if (!entry) continue;
  const name = entry.endsWith("/") ? entry.slice(0, -1) : entry;
  for (const pat of forbiddenPatterns) {
    if (new RegExp(pat.source).test(name)) {
      found.push(entry);
    }
  }
}

if (found.length > 0) {
  fail("scan", "forbidden files found:\n" + found.slice(0, 15).join("\n"));
}

log("scan", "no forbidden files/patterns");
rmSync(tsDir, { recursive: true, force: true });

console.log("\n[security] check completed successfully");
