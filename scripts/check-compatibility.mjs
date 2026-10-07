#!/usr/bin/env node
/**
 * Fail-fast compatibility gate.
 *
 * Reads the single-source matrix at tests/e2e/opencode/compatibility-matrix.mjs
 * and validates the Node runtime (and OpenCode, when a minimum is available).
 * Exits non-zero for unsupported versions so CI / release-gate stop immediately.
 *
 * Usage:
 *   node scripts/check-compatibility.mjs
 *   node scripts/check-compatibility.mjs --node 18.0.0        # simulate reject
 *   node scripts/check-compatibility.mjs --min-opencode 1.0.0 --opencode 0.9.0
 *   node scripts/check-compatibility.mjs --json
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPATIBILITY_MATRIX,
  checkCompatibility,
} from "../tests/e2e/opencode/compatibility-matrix.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ node?: string, opencode?: string, minOpencode?: string, json: boolean, detect: boolean }} */
  const out = { json: false, detect: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--node":
        out.node = argv[++i];
        break;
      case "--opencode":
        out.opencode = argv[++i];
        break;
      case "--min-opencode":
        out.minOpencode = argv[++i];
        break;
      case "--no-detect":
        out.detect = false;
        break;
      case "--json":
        out.json = true;
        break;
      case "-h":
      case "--help":
        console.log(
          "usage: node scripts/check-compatibility.mjs [--node V] [--opencode V] [--min-opencode V] [--no-detect] [--json]",
        );
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`unknown flag: ${arg}`);
          process.exit(2);
        }
    }
  }
  return out;
}

/** Detect the installed OpenCode version, or null when unavailable. */
function detectOpenCodeVersion() {
  const probe = spawnSync("opencode", ["--version"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (probe.status !== 0 || typeof probe.stdout !== "string") return null;
  const match = probe.stdout.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : probe.stdout.trim() || null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const nodeVersion = args.node ?? process.versions.node;
  let opencodeVersion = args.opencode ?? null;
  if (opencodeVersion == null && args.detect && args.minOpencode == null && COMPATIBILITY_MATRIX.opencode.minimum == null) {
    opencodeVersion = null; // nothing to enforce; don't probe needlessly
  } else if (opencodeVersion == null && args.detect) {
    opencodeVersion = detectOpenCodeVersion();
  }

  const result = checkCompatibility({
    nodeVersion,
    opencodeVersion,
    opencodeMinimum: args.minOpencode === undefined ? undefined : args.minOpencode,
  });

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const nodeLine = `node ${result.node.version} ${result.node.ok ? "OK" : "UNSUPPORTED"} (supported "${result.node.supported}")`;
    console.log(nodeLine);
    if (result.opencode.enforced) {
      console.log(
        `opencode ${result.opencode.version ?? "unknown"} ${result.opencode.ok ? "OK" : "UNSUPPORTED"} (minimum "${result.opencode.minimum}")`,
      );
    } else if (result.opencode.minimum == null) {
      console.log(
        "opencode SKIP (minimum undetermined; no single-install compatibility claim)",
      );
    } else {
      console.log(
        `opencode version not detected (minimum "${result.opencode.minimum}"); cannot verify`,
      );
    }
    for (const failure of result.failures) console.error(`FAIL [${failure.kind}] ${failure.message}`);
  }

  process.exit(result.ok ? 0 : 1);
}

main();
