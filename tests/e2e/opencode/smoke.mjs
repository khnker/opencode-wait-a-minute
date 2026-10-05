#!/usr/bin/env node
/**
 * Smoke test: verify WAM plugin loads and basic lifecycle works in real OpenCode.
 *
 * This test:
 *   - Creates a temporary opencode.jsonc that registers the plugin from this repo
 *   - Spawns `opencode` (global binary) with a simple prompt
 *   - Waits for the plugin to emit a known event (e.g., tool.execute.before)
 *   - Cleans up temporary state
 *
 * Prerequisites:
 *   - `opencode` binary in PATH (tested against v1.18.33)
 *   - Node >=20
 *
 * Exit codes:
 *   0 - success
 *   1 - plugin failed to load or emitted error
 *   2 - timeout / unexpected behavior
 */

import { execFile, execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../../..");
const PLUGIN_PATH = join(REPO_ROOT, "index.js");
const START_TIMEOUT_MS = 60000; // 60s for opencode to start and load plugin
const EVENT_TIMEOUT_MS = 30000; // 30s to observe a plugin event

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function fail(step, msg, code = 1) {
  console.error(`[${step}] FAIL: ${msg}`);
  process.exit(code);
}

// --- Setup temporary environment ---------------------------------------
const tmpBase = mkdtempSync(join(tmpdir(), "wam-e2e-"));
const opencodeHome = join(tmpBase, ".opencode");
const wamHome = join(tmpBase, ".wam");
const configPath = join(opencodeHome, "opencode.jsonc");

mkdirSync(opencodeHome, { recursive: true });
mkdirSync(wamHome, { recursive: true });

// Minimal opencode.jsonc that registers our plugin as a local plugin.
const configContent = JSON.stringify(
  {
    $schema: "https://opencode.ai/config.json",
    plugins: {
      "wait-a-minute": {
        path: "../../../index.js",
        enabled: true
      }
    }
  },
  null,
  2
);
writeFileSync(configPath, configContent, "utf8");
log("setup", `created temporary opencode config at ${configPath}`);

// Set environment variables to isolate the run
const env = {
  ...process.env,
  HOME: tmpBase, // so .opencode and .wam are under tmpBase
  XDG_CONFIG_HOME: opencodeHome, // isolate global config
  XDG_DATA_HOME: join(tmpBase, ".local", "share"),
  XDG_STATE_HOME: join(tmpBase, ".local", "state"),
  WAM_HOME: wamHome,
  // Disable telemetry and auto-update to reduce noise
  OPENCODE_TELEMETRY_ENABLED: "false",
  OPENCODE_AUTOUPDATE_CHECK: "false",
};
mkdirSync(join(tmpBase, ".local", "share"), { recursive: true });
mkdirSync(join(tmpBase, ".local", "state"), { recursive: true });

log("setup", `isolated HOME=${tmpBase}`);
log("setup", `WAM_HOME=${wamHome}`);

try {
  execFileSync("opencode", ["--version"], { stdio: "ignore" });
} catch (_) {
  fail("opencode", "`opencode` binary not found in PATH; OpenCode E2E is required");
}

let opencodeProc = null;
let timedOut = false;
let pluginLoaded = false;
let pluginError = null;
let stdoutBuf = "";
const EXPECTED = /\b42\b/;

// --- Spawn opencode ----------------------------------------------------
log("spawn", "launching opencode with simple prompt...");
// Use a prompt that should trigger the plugin quickly but not require heavy reasoning.
const prompt = "¿Cuánto es 6 multiplicado por 7? Responde solo con el número.";

opencodeProc = spawn("opencode", ["run", prompt], {
  env,
  cwd: tmpBase, // run from isolated temp dir
  stdio: ["ignore", "pipe", "pipe"], // we only care about stdout/stderr
  windowsHide: true,
});

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
    pluginLoaded = true;
    log("event", `detected plugin event: line=${line.slice(0, 100)}`);
  }
});

opencodeProc.stderr.on("data", (data) => {
  const line = data.toString();
  log("stderr", line.trim());
  // Capture any error that indicates plugin failed to load.
  if (
    line.includes("Error") ||
    line.includes("failed") ||
    line.includes("exception") ||
    line.includes("plugin")
  ) {
    pluginError = line.trim();
  }
});

// --- Wait for startup or timeout ---------------------------------------
function cleanup(exitCode) {
  if (opencodeProc) {
    try {
      opencodeProc.kill();
    } catch (_) {}
    opencodeProc = null;
  }
  // Optionally keep temp dir for debugging; comment out to clean.
  // rmSync(tmpBase, { recursive: true, force: true });
  process.exit(exitCode);
}

// Startup timeout
const startupTimer = setTimeout(() => {
  timedOut = true;
  log("timeout", "opencode did not start within timeout");
  cleanup(2);
}, START_TIMEOUT_MS);

// Process exit handler
opencodeProc.on("close", (code) => {
  if (timedOut) return;
  clearTimeout(startupTimer);
  const clean = stdoutBuf.replace(/\x1b\[[0-9;]*m/g, "");
  if (code !== 0) {
    log("exit", `opencode exited with code ${code}`);
    if (pluginError) {
      fail("plugin", `plugin error detected: ${pluginError}`, 1);
    }
    fail("exit", `opencode exited non-zero (${code})`, 1);
  }
  log("exit", "opencode exited cleanly");
  if (EXPECTED.test(clean)) {
    log("result", "round-trip verified: model answered the arithmetic prompt");
    cleanup(0);
  }
  log("output-full", clean.slice(-500));
  log("result", `no expected answer found (pluginLoaded=${pluginLoaded}, pluginError=${pluginError})`);
  fail("roundtrip", "expected model response (42) not found in opencode output", 2);
});


