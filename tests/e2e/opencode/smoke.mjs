#!/usr/bin/env node
/**
 * E2E smoke test: verify the WAM plugin loads from the PACKED ARTIFACT inside a
 * real OpenCode instance and emit a machine-readable summary.
 *
 * Flow:
 *   1. `npm pack` the repo into an isolated temp dir.
 *   2. `npm install` the produced .tgz into a fresh temp workspace (own node_modules).
 *   3. Register the plugin in a temp opencode.jsonc pointing at the installed
 *      package entry (`node_modules/wait-a-minute/index.js`, i.e. the installed main).
 *   4. Spawn real `opencode`, wait for a plugin event, assert the round-trip.
 *   5. Emit `WAM_E2E_SUMMARY {json}` (also written to $WAM_E2E_SUMMARY_PATH when set).
 *
 * The source checkout is NEVER substituted for the published package: the code
 * that runs comes from the installed tarball only.
 *
 * Prerequisites:
 *   - `opencode` binary in PATH
 *   - `npm` (used for pack/install)
 *   - Node >=20
 *
 * Exit codes:
 *   0 - pass
 *   1 - pack/install/plugin failure
 *   2 - timeout / round-trip mismatch
 */

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";

// Compatibility fail-fast check
const matrixConfig = JSON.parse(readFileSync(new URL("./matrix-config.json", import.meta.url), "utf8"));
if (process.versions.node < matrixConfig.minNode) {
  console.error(`Incompatible Node version: ${process.versions.node}. Required: >=${matrixConfig.minNode}`);
  process.exit(1);
}
import {
  assertSupportedNode,
} from "./compatibility-matrix.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../../..");
const PKG_NAME = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")).name;

// Fail fast on an unsupported Node runtime. The supported range lives in the
// machine-readable matrix (compatibility-matrix.mjs), never in this file.
assertSupportedNode(process.versions.node);

const START_TIMEOUT_MS = 60000; // 60s for opencode to start and load plugin
const EVENT_TIMEOUT_MS = 30000; // 30s to observe a plugin event
const EXPECTED = /\b42\b/;
const SUMMARY_PREFIX = "WAM_E2E_SUMMARY ";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

class HarnessError extends Error {
  constructor(step, message, code = 1) {
    super(message);
    this.step = step;
    this.code = code;
  }
}

function fail(step, msg, code = 1) {
  throw new HarnessError(step, msg, code);
}

// --- Setup temporary environment ---------------------------------------
const tmpBase = mkdtempSync(join(tmpdir(), "wam-e2e-"));
const workspace = join(tmpBase, "workspace");
const configHome = join(tmpBase, ".config"); // XDG_CONFIG_HOME parent
const wamHome = join(tmpBase, ".wam");
const configPath = join(workspace, "opencode.jsonc"); // project config
const wrapperPath = join(workspace, "wam-e2e-entry.mjs");
const markerPath = join(tmpBase, "wam-plugin-loaded.marker");

const summary = { artifact: null, instance: null, loaded: false, verdict: "fail" };
let summaryEmitted = false;
let opencodeProc = null;

function emitSummary() {
  if (summaryEmitted) return;
  summaryEmitted = true;
  console.log(`${SUMMARY_PREFIX}${JSON.stringify(summary)}`);
  const outPath = process.env.WAM_E2E_SUMMARY_PATH;
  if (outPath) {
    try {
      writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    } catch (err) {
      console.error(`[summary] WARN: could not write ${outPath}: ${err.message}`);
    }
  }
}

function cleanup() {
  if (opencodeProc) {
    try {
      opencodeProc.kill();
    } catch (_) {}
    opencodeProc = null;
  }
  rmSync(tmpBase, { recursive: true, force: true });
}

// The plugin persists state under WAM_HOME; a populated directory is direct
// evidence that the plugin actually loaded and executed from the artifact.
function wamStatePresent() {
  try {
    return existsSync(wamHome) && readdirSync(wamHome).length > 0;
  } catch (_) {
    return false;
  }
}

// The generated adapter writes this marker when OpenCode invokes the entry,
// proving the installed artifact (not the checkout) was loaded and executed.
function pluginMarkerPresent() {
  try {
    return existsSync(markerPath);
  } catch (_) {
    return false;
  }
}

// Clear load evidence from a previous attempt so each run is judged on its own
// (otherwise a stale marker from a stalled attempt could mask a failed load).
function resetEvidence() {
  try {
    rmSync(markerPath, { force: true });
  } catch (_) {}
  try {
    rmSync(wamHome, { recursive: true, force: true });
    mkdirSync(wamHome, { recursive: true });
  } catch (_) {}
}

// --- Spawn real opencode against the installed artifact ----------------
function runOpencode(env) {
  return new Promise((resolvePromise) => {
    let timedOut = false;
    let pluginLoaded = false;
    let pluginError = null;
    let spawnError = null;
    let stdoutBuf = "";

    resetEvidence();
    log("spawn", "launching opencode with simple prompt...");
    // A prompt that triggers the plugin quickly without heavy reasoning.
    const prompt = "¿Cuánto es 6 multiplicado por 7? Responde solo con el número.";

    try {
      opencodeProc = spawn("opencode", ["run", prompt], {
        env,
        cwd: workspace, // run from the isolated workspace, not the checkout
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      opencodeProc = null;
      resolvePromise({
        code: 1,
        timedOut: false,
        pluginLoaded: false,
        pluginError: null,
        spawnError: err.message,
        clean: "",
      });
      return;
    }

    let startupTimer = null;
    let eventTimer = null;

    const finish = (payload) => {
      if (startupTimer) clearTimeout(startupTimer);
      if (eventTimer) clearTimeout(eventTimer);
      resolvePromise(payload);
    };

    opencodeProc.stdout.on("data", (data) => {
      const raw = data.toString();
      stdoutBuf += raw;
      const line = raw.replace(/\x1b\[[0-9;]*m/g, "").trim();
      if (!line) return;
      if (line.includes("WAM") || line.includes("wait-a-minute")) {
        log("output", line);
      } else {
        log("output-raw", line.slice(0, 200));
      }
      if (
        line.includes("tool.execute") ||
        line.includes("permission.ask") ||
        line.includes("chat.message") ||
        line.includes("WAM")
      ) {
        if (!pluginLoaded) {
          log("event", `detected plugin event: line=${line.slice(0, 100)}`);
        }
        pluginLoaded = true;
      }
    });

    opencodeProc.stderr.on("data", (data) => {
      const line = data.toString();
      log("stderr", line.trim());
      // Capture any error that indicates the plugin failed to load.
      if (
        line.includes("Error") ||
        line.includes("failed") ||
        line.includes("exception") ||
        line.includes("plugin")
      ) {
        pluginError = line.trim();
      }
    });

    startupTimer = setTimeout(() => {
      timedOut = true;
      log("timeout", "opencode did not finish within timeout");
      try {
        opencodeProc.kill();
      } catch (_) {}
      finish({
        code: 2,
        timedOut: true,
        pluginLoaded,
        pluginError,
        spawnError: null,
        clean: stdoutBuf.replace(/\x1b\[[0-9;]*m/g, ""),
      });
    }, START_TIMEOUT_MS);

    eventTimer = setTimeout(() => {
      if (!pluginLoaded) {
        log("event", "no plugin event observed yet (continuing until process exit)");
      }
    }, EVENT_TIMEOUT_MS);

    opencodeProc.on("error", (err) => {
      spawnError = err.message;
      finish({
        code: 1,
        timedOut: false,
        pluginLoaded,
        pluginError,
        spawnError,
        clean: stdoutBuf,
      });
    });

    opencodeProc.on("close", (code) => {
      if (timedOut) return;
      finish({
        code,
        timedOut: false,
        pluginLoaded,
        pluginError,
        spawnError,
        clean: stdoutBuf.replace(/\x1b\[[0-9;]*m/g, ""),
      });
    });
  });
}

// --- Main flow ---------------------------------------------------------
async function main() {
  mkdirSync(workspace, { recursive: true });
  mkdirSync(configHome, { recursive: true });
  mkdirSync(wamHome, { recursive: true });

  // Step 1: pack the repo into the isolated temp dir.
  log("pack", "creating tarball from repo...");
  const packDir = join(tmpBase, "pack");
  mkdirSync(packDir, { recursive: true });
  const packOut = spawnSync("npm", ["pack", "--pack-destination", packDir], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (packOut.error || packOut.status !== 0) {
    const detail = packOut.error
      ? packOut.error.message
      : (packOut.stderr || "").trim();
    fail("pack", `npm pack unavailable or failed: ${detail}`);
  }
  const tgzEntries = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
  if (tgzEntries.length === 0) {
    fail("pack", "no .tgz file produced by npm pack");
  }
  const artifact = tgzEntries[0];
  const tarball = join(packDir, artifact);
  summary.artifact = artifact;
  log("pack", `produced ${artifact}`);

  // Step 2: install the tarball into a fresh workspace with its own node_modules.
  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify(
      { name: "wam-e2e-workspace", version: "0.0.0", private: true },
      null,
      2
    ),
    "utf8"
  );
  log("install", `installing ${artifact} into ${workspace}`);
  const installOut = spawnSync(
    "npm",
    ["install", tarball, "--no-audit", "--no-fund"],
    {
      cwd: workspace,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (installOut.error || installOut.status !== 0) {
    const detail = installOut.error
      ? installOut.error.message
      : (installOut.stderr || "").trim();
    fail("install", `npm install unavailable or failed: ${detail}`);
  }
  const installedMain = join(
    workspace,
    "node_modules",
    PKG_NAME,
    "index.js"
  );
  if (!existsSync(installedMain)) {
    fail("install", `installed plugin entry not found at ${installedMain}`);
  }
  log("install", `plugin installed at ${installedMain}`);

  // Step 3a: generate a thin adapter that imports the INSTALLED package entry.
  // OpenCode's legacy plugin loader requires every named export to be a function;
  // WAM's index.js also exports a non-function (sessionExecutions), so the adapter
  // exposes exactly one default export pointing at the installed `main`.
  const wrapperSource =
    `import fs from "node:fs";\n` +
    `import WaitAMinutePlugin from ${JSON.stringify(installedMain)};\n` +
    `export default async function waitAMinuteE2EEntry(input) {\n` +
    `  if (process.env.WAM_E2E_MARKER) {\n` +
    `    try { fs.writeFileSync(process.env.WAM_E2E_MARKER, "loaded", "utf8"); } catch (_) {}\n` +
    `  }\n` +
    `  return WaitAMinutePlugin(input);\n` +
    `}\n`;
  writeFileSync(wrapperPath, wrapperSource, "utf8");

  // Step 3b: register the adapter in the temp project opencode.jsonc.
  const configContent = JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      plugin: [wrapperPath],
    },
    null,
    2
  );
  writeFileSync(configPath, configContent, "utf8");
  log("setup", `created temporary opencode config at ${configPath}`);

  // Step 4: isolate HOME/XDG/WAM.
  const env = {
    ...process.env,
    HOME: tmpBase, // so .opencode and .wam are under tmpBase
    XDG_CONFIG_HOME: configHome, // isolate global config
    XDG_DATA_HOME: join(tmpBase, ".local", "share"),
    XDG_STATE_HOME: join(tmpBase, ".local", "state"),
    WAM_HOME: wamHome,
    WAM_E2E_MARKER: markerPath, // written by the adapter when the installed plugin loads
    OPENCODE_TELEMETRY_ENABLED: "false",
    OPENCODE_AUTOUPDATE_CHECK: "false",
  };
  mkdirSync(join(tmpBase, ".local", "share"), { recursive: true });
  mkdirSync(join(tmpBase, ".local", "state"), { recursive: true });
  log("setup", `isolated HOME=${tmpBase}`);
  log("setup", `WAM_HOME=${wamHome}`);

  // Step 5: fail closed when opencode is unavailable.
  try {
    const versionOut = execFileSync("opencode", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    summary.instance = (versionOut || "").trim();
  } catch (err) {
    fail(
      "opencode",
      `\`opencode\` binary not found in PATH; OpenCode E2E is required (${err.message})`
    );
  }
  if (!summary.instance) {
    fail("opencode", "unable to determine `opencode --version`");
  }
  log("opencode", `using instance ${summary.instance}`);

  // Step 6: spawn real opencode and observe the plugin.
  // The model backend intermittently stalls (opencode emits no model output and
  // never exits); retry a few times before declaring the harness failed.
  const MAX_ATTEMPTS = 3;
  let result = await runOpencode(env);
  for (let attempt = 2; attempt <= MAX_ATTEMPTS && result.timedOut; attempt++) {
    log(
      "retry",
      `opencode attempt ${attempt - 1}/${MAX_ATTEMPTS} stalled; retrying`
    );
    result = await runOpencode(env);
  }
  const wamState = wamStatePresent();
  const marker = pluginMarkerPresent();
  summary.loaded = result.pluginLoaded || wamState || marker;
  log(
    "event",
    `plugin loaded=${summary.loaded} (stdout=${result.pluginLoaded}, wamState=${wamState}, marker=${marker})`
  );

  if (result.timedOut) {
    fail(
      "timeout",
      `opencode did not finish within timeout after ${MAX_ATTEMPTS} attempts`,
      2
    );
  }
  if (result.spawnError) {
    fail("spawn", `failed to spawn opencode: ${result.spawnError}`, 1);
  }
  if (result.code !== 0) {
    if (result.pluginError) {
      fail("plugin", `plugin error detected: ${result.pluginError}`, 1);
    }
    fail("exit", `opencode exited non-zero (${result.code})`, 1);
  }
  if (!EXPECTED.test(result.clean)) {
    log("output-full", result.clean.slice(-500));
    fail("roundtrip", "expected model response (42) not found in opencode output", 2);
  }
  if (!summary.loaded) {
    fail("plugin", "plugin was not observed loading from the packed artifact", 1);
  }
  log(
    "result",
    "round-trip verified: model answered and plugin loaded from the packed artifact"
  );
}

let exitCode = 0;
try {
  await main();
  summary.verdict = "pass";
  console.log(`${GREEN}[summary] VERDICT: pass${RESET}`);
} catch (err) {
  if (err instanceof HarnessError) {
    console.error(`${RED}[${err.step}] FAIL: ${err.message}${RESET}`);
    exitCode = err.code;
  } else {
    console.error(
      `${RED}[harness] unexpected error: ${err && err.stack ? err.stack : err}${RESET}`
    );
    exitCode = 1;
  }
  if (process.env.WAM_E2E_DEBUG) {
    console.error(`${YELLOW}[harness] WAM_E2E_DEBUG set; temp dir was ${tmpBase}${RESET}`);
  }
} finally {
  cleanup();
}

// Emitted even on failure, before exiting non-zero.
emitSummary();
process.exit(exitCode);
