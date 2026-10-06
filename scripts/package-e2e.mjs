#!/usr/bin/env node
/**
 * Package E2E test: install the packed tarball and verify basic plugin load.
 *
 * This test:
 *   - Runs `npm pack` to produce a tarball
 *   - Installs the tarball in a temporary directory (clean node_modules)
 *   - Dynamically imports the plugin's entry point (index.js)
 *   - Validates that the plugin exports a function (the loader)
 *
 * Prerequisites:
 *   - npm >=10
 *   - Node >=20
 *
 * Exit codes:
 *   0 - success
 *   1 - pack/install/import failed
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg, code = 1) {
  console.error(`[${step}] FAIL: ${msg}`);
  process.exit(code);
}

function cleanup(...dirs) {
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

async function main() {
  const tmpDir = mkdtempSync(join(tmpdir(), "wam-pack-e2e-"));
  const installDir = mkdtempSync(join(tmpdir(), "wam-install-e2e-"));

  try {
    // --- Step 1: pack ----------------------------------------------------
    log("pack", "creating tarball...");
    const packOut = spawnSync("npm", ["pack", "--pack-destination", tmpDir], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (packOut.error || packOut.status !== 0) {
      const err = packOut.error ? packOut.error.message : packOut.stderr;
      fail("pack", `npm pack failed: ${err}`);
    }

    const entries = readdirSync(tmpDir).filter((f) => f.endsWith(".tgz"));
    if (entries.length === 0) {
      fail("pack", "no .tgz file produced by npm pack");
    }
    const tarball = join(tmpDir, entries[0]);
    log("pack", `produced ${tarball}`);

    // --- Step 2: install in clean temp -----------------------------------
    log("install", `installing tarball into ${installDir}`);
    const installOut = spawnSync("npm", ["install", "--no-audit", "--no-fund", tarball], {
      cwd: installDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (installOut.error || installOut.status !== 0) {
      const err = installOut.error ? installOut.error.message : installOut.stderr;
      fail("install", `npm install failed: ${err}`);
    }

    // --- Step 3: import the plugin ---------------------------------------
    const pluginPath = join(installDir, "node_modules", "wait-a-minute", "index.js");
    if (!existsSync(pluginPath)) {
      fail("import", `plugin entry point not found at ${pluginPath}`);
    }

    let pluginModule;
    try {
      pluginModule = await import(pathToFileURL(pluginPath).href);
    } catch (e) {
      fail("import", `failed to import plugin: ${e.message}`);
    }

    const loader = pluginModule.default ?? pluginModule;
    if (typeof loader !== "function") {
      fail("import", `plugin export is not a function; got ${typeof loader}`);
    }

    log("import", "plugin loaded successfully (export is a function)");
    log("result", "Package E2E test PASSED");
  } finally {
    cleanup(tmpDir, installDir);
  }
}

main().catch((e) => {
  console.error(`[unexpected] FAIL: ${e.stack || e.message}`);
  process.exit(1);
});
