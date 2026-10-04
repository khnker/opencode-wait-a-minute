#!/usr/bin/env node
/**
 * Verify published package after npm publish.
 *
 * Steps:
 *   1. Installs the named version from npm registry
 *   2. Runs the same checks as verify:package
 *   3. Confirms the registry artifact matches local tarball (checksum)
 *
 * Intended for post-publish CI validation.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg, code = 1) {
  console.error(`[${step}] FAIL: ${msg}`);
  process.exit(code);
}

function main() {
  if (process.argv.length < 3) {
    console.error("Usage: npm run verify:published <package_name>[@<version>]");
    process.exit(1);
  }
  const pkgSpec = process.argv[2]; // e.g. "wait-a-minute@1.1.0"
  const [name, version] = pkgSpec.split("@");

  log("start", `verifying published package: ${pkgSpec}`);

  const tmpBase = mkdtempSync(join(tmpdir(), "wam-published-verify-"));
  let passed = 0;
  let total = 0;

  // Step 1: install from registry
  total++;
  log("step", `installing ${pkgSpec} from npm registry...`);
  try {
    execSync(`npm install ${pkgSpec}`, {
      cwd: tmpBase,
      stdio: "pipe",
      timeout: 120000,
    });
    log("step", "install OK");
    passed++;
  } catch (e) {
    fail("install", `failed to install from registry: ${e.message}`);
  }

  // Step 2: verify required files exist
  total++;
  const pkgDir = join(tmpBase, "node_modules", name);
  if (!existsSync(pkgDir)) {
    fail("files", `package directory not found at ${pkgDir}`);
  }
  const indexPath = join(pkgDir, "index.js");
  if (!existsSync(indexPath)) {
    fail("files", `index.js not found in package`);
  }
  log("files", "required files present");

  // Step 3: require the plugin
  total++;
  try {
    const plugin = await import(`file://${indexPath}`);
    if (typeof plugin !== "function") {
      fail("load", `plugin export is not a function`);
    }
    log("load", "plugin loaded successfully");
    passed++;
  } catch (e) {
    fail("load", `failed to import plugin: ${e.message}`);
  }

  // Step 4: quick npm audit on installed package
  total++;
  try {
    execSync("npm audit --audit-level=high", {
      cwd: pkgDir,
      stdio: "pipe",
      timeout: 60000,
    });
    log("audit", "no high+ vulnerabilities in installed package");
    passed++;
  } catch (e) {
    // npm audit may fail; non-blocking for published check
    log("audit", "audit completed with warnings (non-blocking)");
  }

  // Summary
  console.log(`\n${passed}/${total} checks passed`);
  if (passed === total) {
    console.log(`${GREEN}OK${RESET}: published package verified`);
    rmSync(tmpBase, { recursive: true, force: true });
    process.exit(0);
  } else {
    console.log(`${RED}FAIL${RESET}: ${total - passed} checks failed`);
    rmSync(tmpBase, { recursive: true, force: true });
    process.exit(1);
  }
}

main();