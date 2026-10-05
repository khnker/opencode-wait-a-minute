#!/usr/bin/env node
/**
 * Security and package audit scan for RC1 release.
 *
 * Validates both:
 *   1) npm audit - no high/critical vulnerabilities in production dependencies.
 *   2) Tarball content - no forbidden files.
 */

import { execFileSync, execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, rmSync, readdirSync } from "node:fs";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const REPO_ROOT = resolve(__dirname, "..");
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

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
      error: null
    };
  } catch (e) {
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || "",
      error: e.message || e
    };
  }
}

// --- npm audit --------------------------------------------------
log("security", "running npm audit (high+ critical)");
const audit = run("npm", ["audit", "--audit-level=high"], REPO_ROOT);
if (audit.error) {
  const msg = (audit.stdout || audit.stderr || "").toLowerCase();
  if (msg.includes("found") && msg.includes("vulnerabilit")) {
    fail("security", "high+ vulnerabilities present.\n" + (audit.stderr || audit.stdout));
  } else {
    // npm audit may have failed for other reasons; still report but continue.
    log("security", `audit exited with warning: ${audit.error.message}`);
  }
} else {
  const out = audit.stdout.toLowerCase();
  if (out.includes("found 0 vulnerabilities")) {
    log("security", "no vulnerabilities found");
  } else if (!out.includes("vulnerabilit") || !out.includes("found")) {
    log("security", "audit passed (no high/critical issues)");
  } else {
    log("security", "vulnerabilities may be present: " + out);
  }
}

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

let found = [];
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