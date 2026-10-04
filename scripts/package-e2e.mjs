#!/usr/bin/env node
/**
 * Package E2E test: install the packed tarball and verify basic plugin load.
 *
 * This test:
 *   - Runs `npm pack` to produce a tarball
 *   - Installs the tarball in a temporary directory (clean node_modules)
 *   - Attempts to require the plugin's entry point (index.js)
 *   - Validates that the plugin exports a function (the loader)
 *
 * Prerequisites:
 *   - npm >=10
 *   - Node >=20
 *
 * Exit codes:
 *   0 - success
 *   1 - pack/install/require failed
 */

import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";

const REPO_ROOT = resolve(__dirname, "..");
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

// --- Step 1: pack ------------------------------------------------------
log("pack", "creating tarball...");
const tmpDir = mkdtempSync(join(tmpdir(), "wam-pack-e2e-"));
const packOut = spawnSync("npm", ["pack", "--pack-destination", tmpDir], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (packOut.error || packOut.status !== 0) {
  const err = packOut.error ? packOut.error.message : packOut.stderr;
  fail("pack", `npm pack failed: ${err}`);
}

// Find the generated tgz
const entries = readdirSync(tmpDir).filter((f) => f.endsWith(".tgz"));
if (entries.length === 0) {
  fail("pack", "no .tgz file produced by npm pack");
}
const tarball = join(tmpDir, entries[0]);
log("pack", `produced ${tarball}`);

// --- Step 2: install in clean temp -------------------------------------
const installDir = mkdtempSync(join(tmpdir(), "wam-install-e2e-"));
log("install", `installing tarball into ${installDir}`);

const installOut = spawnSync("npm", ["install", tarball], {
  cwd: installDir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (installOut.error || installOut.status !== 0) {
  const err = installOut.error ? installOut.error.message : installOut.stderr;
  fail("install", `npm install failed: ${err}`);
}

// --- Step 3: require the plugin ----------------------------------------
const pluginPath = join(installDir, "node_modules", "wait-a-minute", "index.js");
if (!existsSync(pluginPath)) {
  fail("require", `plugin entry point not found at ${pluginPath}`);
}

let pluginModule;
try {
  // eslint-disable-next-line no-undef
  pluginModule = require(pluginPath);
} catch (e) {
  fail("require", `failed to require plugin: ${e.message}`);
}

// Validate that it's a function (the loader)
if (typeof pluginModule !== "function") {
  fail("require", `plugin export is not a function; got ${typeof pluginModule}`);
}

log("require", "plugin loaded successfully (export is a function)");
log("result", "Package E2E test PASSED");

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
rmSync(installDir, { recursive: true, force: true });

process.exit(0);