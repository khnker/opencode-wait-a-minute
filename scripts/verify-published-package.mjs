#!/usr/bin/env node
/**
 * Verify published package after npm publish.
 *
 * Steps:
 *   1. Installs the exact requested version from the npm registry into a temp dir
 *   2. Verifies the installed version matches the requested version
 *   3. Verifies the expected published files exist (per `files`/`main`)
 *   4. Imports the package entrypoint as a runtime smoke test
 *
 * Intended for post-publish CI validation.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function collectExpectedPaths(pkgJson) {
  const paths = new Set();
  if (pkgJson.main) paths.add(pkgJson.main);
  for (const entry of pkgJson.files || []) {
    if (typeof entry !== "string") continue;
    if (entry.startsWith("!")) continue; // exclusion pattern, not an expected path
    paths.add(entry);
  }
  return [...paths];
}

function verifyExpectedFiles(pkgDir, pkgJson) {
  const expected = collectExpectedPaths(pkgJson);
  const missing = [];

  for (const entry of expected) {
    const clean = entry.replace(/\/$/, "");
    const hasGlob = /[*?[\]]/.test(clean);

    if (!hasGlob) {
      if (!existsSync(join(pkgDir, clean))) missing.push(entry);
      continue;
    }

    const slash = clean.indexOf("/");
    const base = slash === -1 ? "" : clean.slice(0, slash);
    const pattern = slash === -1 ? clean : clean.slice(slash + 1);
    const dir = base ? join(pkgDir, base) : pkgDir;
    if (!existsSync(dir)) {
      missing.push(entry);
      continue;
    }
    const re = globToRegExp(pattern);
    if (!readdirSync(dir).some((name) => re.test(name))) missing.push(entry);
  }

  if (missing.length > 0) {
    throw new Error(`expected published files missing: ${missing.join(", ")}`);
  }
  log("step", `verified ${expected.length} expected published path(s)`);
}

async function main() {
  const spec = process.argv[2];
  if (!spec) {
    throw new Error("usage: npm run verify:published -- <name>@<version>");
  }

  const at = spec.lastIndexOf("@");
  if (at <= 0 || at === spec.length - 1) {
    throw new Error(`invalid package spec "${spec}" — expected <name>@<version>`);
  }
  const name = spec.slice(0, at);
  const version = spec.slice(at + 1);

  log("start", `verifying published package: ${name}@${version}`);

  const tmpBase = mkdtempSync(join(tmpdir(), "wam-published-verify-"));
  try {
    // Step 1 — install the exact version from the registry
    log("step", `installing ${name}@${version} from npm registry...`);
    try {
      execFileSync("npm", ["install", "--no-save", `${name}@${version}`], {
        cwd: tmpBase,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 120000,
      });
    } catch (e) {
      throw new Error(`install from registry failed: ${e.message || String(e)}`);
    }
    log("step", "install OK");

    // Step 2 — verify the installed version matches the requested one
    const pkgDir = join(tmpBase, "node_modules", name);
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) {
      throw new Error(`installed package.json not found at ${pkgJsonPath}`);
    }
    let pkgJson;
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    } catch (e) {
      throw new Error(`cannot parse installed package.json: ${e.message || String(e)}`);
    }
    if (pkgJson.version !== version) {
      throw new Error(`installed version ${pkgJson.version} does not match requested ${version}`);
    }
    log("step", `installed version ${pkgJson.version} matches requested ${version}`);

    // Step 3 — verify the expected published files exist
    verifyExpectedFiles(pkgDir, pkgJson);

    // Step 4 — runtime smoke import of the entrypoint
    const entry = join(pkgDir, pkgJson.main || "index.js");
    if (!existsSync(entry)) {
      throw new Error(`entrypoint not found: ${entry}`);
    }
    let mod;
    try {
      mod = await import(pathToFileURL(entry).href);
    } catch (e) {
      throw new Error(`failed to import entrypoint: ${e.message || String(e)}`);
    }
    const exported = Object.keys(mod);
    if (exported.length === 0) {
      throw new Error("entrypoint imported but exported nothing");
    }
    log("step", `runtime smoke import OK (${exported.length} export(s))`);
  } finally {
    rmSync(tmpBase, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    console.log("PUBLISHED: PASS");
  })
  .catch((e) => {
    console.error(`PUBLISHED: FAIL — ${e.message || String(e)}`);
    process.exit(1);
  });
