#!/usr/bin/env node
/**
 * WAM Skill Upstream Sync — materializa `upstream/<id>/` desde SOURCE_CONFIG.
 *
 * Para cada fuente:
 *   - si upstream/<id>/ no existe → git clone --depth 1 <repository>
 *   - si existe → git fetch --depth 1 origin, luego checkout FETCH_HEAD
 *   - si source.ref esta fijado, ademas: fetch --depth 1 origin <ref> y checkout
 *     FETCH_HEAD (funciona tanto para ramas como para SHAs)
 *
 * Imprime "<id>: <resolved-sha>" por fuente. Sale con codigo no-cero ante
 * cualquier fallo. Es idempotente y re-ejecutable.
 *
 * Resuelve la raiz del repo relativa a este script, no al cwd, para que
 * funcione desde cualquier directorio de invocacion.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { SOURCE_CONFIG } = require("./sources.cjs");

const REPO_DIR = path.resolve(__dirname, "..");
const UPSTREAM_DIR = path.join(REPO_DIR, "upstream");

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).toString("utf8");
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function resolveSha(dir) {
  const head = fs.readFileSync(path.join(dir, ".git", "HEAD"), "utf8").trim();
  if (head.startsWith("ref:")) {
    const refRel = head.replace(/^ref:\s*/, "");
    const refFile = path.join(dir, ".git", refRel);
    if (exists(refFile)) {
      return fs.readFileSync(refFile, "utf8").trim();
    }
    // packed-refs fallback
    const packed = path.join(dir, ".git", "packed-refs");
    if (exists(packed)) {
      const line = fs
        .readFileSync(packed, "utf8")
        .split("\n")
        .find((l) => l.endsWith(" " + refRel) || l === refRel);
      if (line) return line.split(" ")[0];
    }
    return null;
  }
  return head;
}

function syncOne(source) {
  const target = path.join(UPSTREAM_DIR, source.id);
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true });

  if (!exists(target)) {
    // fresh clone (shallow, no tags, no remotes refs beyond the default)
    runGit(["clone", "--depth", "1", source.repository, target], REPO_DIR);
  } else {
    // existing clone: refresh origin and default branch, then checkout
    runGit(["fetch", "--depth", "1", "origin"], target);
    runGit(["checkout", "--force", "FETCH_HEAD"], target);
  }

  if (source.ref) {
    // pin to a specific ref (branch/tag/SHA). Works for SHAs because
    // `fetch --depth 1 origin <sha>` followed by `checkout FETCH_HEAD`
    // detaches HEAD at that commit.
    runGit(["fetch", "--depth", "1", "origin", source.ref], target);
    runGit(["checkout", "--force", "FETCH_HEAD"], target);
  }

  const sha = resolveSha(target);
  if (!sha) {
    throw new Error(`no se pudo resolver SHA para ${source.id} en ${target}`);
  }
  console.log(`${source.id}: ${sha}`);
}

let failed = 0;
for (const source of SOURCE_CONFIG) {
  try {
    syncOne(source);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${source.id}: ${err && err.message ? err.message : err}`);
    if (err && err.stderr) console.error(err.stderr.toString("utf8"));
  }
}

if (failed > 0) {
  console.error(`sync-upstream: ${failed} source(s) failed`);
  process.exit(1);
}
