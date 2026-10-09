#!/usr/bin/env node
/**
 * Tarball install identity assertion.
 *
 * Workflow:
 *   1. Pack the working tree into a `.tgz` via `npm pack --silent`.
 *   2. Install the tarball into a fresh temp directory (no save, no lockfile).
 *   3. Read the installed `package.json` and assert its `name` equals the
 *      canonical package identity `opencode-wait-a-minute`.
 *
 * Exits 0 on success, 1 on any failure. Intended to run in CI and locally.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CANONICAL_NAME = "opencode-wait-a-minute";

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

function main() {
  const tmp = mkdtempSync(join(tmpdir(), "wam-tarball-install-"));
  try {
    log("pack", "running npm pack...");
    const packOut = run("npm", ["pack", "--pack-destination", tmp], REPO_ROOT);
    const tarballName = packOut.trim().split("\n").pop();
    const tarball = join(tmp, tarballName);
    if (!existsSync(tarball)) {
      fail("pack", `tarball not produced: ${tarball}`);
    }
    log("pack", `produced ${tarballName}`);

    log("install", `installing into ${tmp}...`);
    run("npm", ["install", tarball, "--no-save", "--no-package-lock", "--silent"], tmp);

    const moduleDir = join(tmp, "node_modules", CANONICAL_NAME);
    if (!existsSync(moduleDir)) {
      const nm = join(tmp, "node_modules");
      const candidates = existsSync(nm) ? readdirSync(nm) : [];
      fail(
        "verify",
        `installed package not found at node_modules/${CANONICAL_NAME} (found: ${candidates.join(", ") || "none"})`,
      );
    }

    const installedName = JSON.parse(
      readFileSync(join(moduleDir, "package.json"), "utf8"),
    ).name;
    if (installedName !== CANONICAL_NAME) {
      fail(
        "verify",
        `identity drift: installed package name is '${installedName}', expected '${CANONICAL_NAME}'`,
      );
    }

    log("verify", `package name is ${installedName} (ok)`);
    log("done", "verify-tarball-install PASSED");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
