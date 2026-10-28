#!/usr/bin/env node
/**
 * Verify the package installs cleanly from a tarball and exposes an importable API.
 *
 * Workflow:
 *   1. Pack the working tree into a `.tgz` via `npm pack`.
 *   2. Install the tarball into a fresh temp directory (clean node_modules).
 *   3. Import the installed package and assert the public API is present.
 *   4. `createEngine({ root })` constructs an engine with a `query()` method
 *      without writing to the target repository.
 *
 * Exits 0 on success, 1 on any failure.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PKG_NAME = "context-query-core";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg) {
  console.error(`[${step}] FAIL: ${msg}`);
  process.exit(1);
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), "cqe-pack-test-"));
  try {
    log("pack", "running npm pack...");
    const packOut = run("npm", ["pack", "--pack-destination", tmp], REPO_ROOT);
    const tarballName = packOut.trim().split("\n").pop();
    const tarball = join(tmp, tarballName);
    if (!existsSync(tarball)) fail("pack", `tarball not produced: ${tarball}`);
    log("pack", `produced ${tarballName}`);

    const installDir = join(tmp, "app");
    mkdirSync(installDir, { recursive: true });
    log("install", `installing into ${installDir}...`);
    run("npm", ["install", tarball, "--no-save", "--no-package-lock", "--silent"], installDir);

    const pkgDir = join(installDir, "node_modules", PKG_NAME);
    if (!existsSync(pkgDir)) fail("install", `${PKG_NAME} not found in node_modules`);

    const installedName = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).name;
    if (installedName !== PKG_NAME) {
      fail("verify", `identity drift: installed name is '${installedName}', expected '${PKG_NAME}'`);
    }
    log("verify", `package name is ${installedName} (ok)`);

    const mod = await import(pathToFileURL(join(pkgDir, "index.js")).href);
    for (const fn of ["createEngine", "runCQP", "runIntent"]) {
      if (typeof mod[fn] !== "function") fail("api", `missing public export: ${fn}`);
    }
    const engine = mod.createEngine({ root: REPO_ROOT });
    if (!engine || typeof engine.query !== "function") {
      fail("api", "createEngine() did not return an engine with query()");
    }
    log("api", "createEngine + public exports ok");

    log("done", "verify-package PASSED");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e) => fail("unexpected", e?.stack || String(e)));
