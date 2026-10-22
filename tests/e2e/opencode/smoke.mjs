#!/usr/bin/env node
/**
 * E2E smoke test: verify the WAM plugin loads from the PACKED ARTIFACT inside a
 * real OpenCode instance and emit a machine-readable summary.
 *
 * Flow:
 *   1. `npm pack` the repo into an isolated temp dir.
 *   2. `npm install` the produced .tgz into a fresh temp workspace (own node_modules).
 *   3. Register the plugin in a temp opencode.jsonc pointing at the installed
 *      package entry (`node_modules/opencode-wait-a-minute/index.js`, i.e. the installed main).
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
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
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

// The model backend intermittently stalls (opencode emits no model output and
// never exits), occasionally exits non-zero without a plugin error, and
// sometimes answers without the expected payload. Those are transient for a
// live backend, so a bounded number of attempts is made before failing.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000;

// Hooks the plugin must register for the gate to be effective. The plugin
// factory returns them as a hook map; `plugin.on(...)` registrations are also
// accepted so the assertion survives a change of registration style.
const EXPECTED_HOOKS = ["chat.message", "tool.execute.before", "tool.execute.after"];

// Recognized entries of the `.wam/` state directory. The layout comes from
// src/persistence/memory.js (context/tasks/skills/cache/history) plus the
// runtime files the plugin writes while a session is active.
const WAM_STATE_ENTRIES = [
  "context",
  "tasks",
  "skills",
  "cache",
  "history",
  "traces",
  "metrics",
  "active-task",
  "task-state.json",
  "session.json",
  "config.json",
  "references.json",
  "plugin.log",
];

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
const hooksPath = join(tmpBase, "wam-plugin-hooks.json"); // hook registrations observed by the adapter

const summary = {
  artifact: null,
  instance: null,
  loaded: false,
  hooks: { on: [], returned: [], registered: [] },
  state: { dir: null, root: null, entries: [], taskArtifacts: [] },
  attempts: 0,
  verdict: "fail",
};
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
  if (process.env.WAM_E2E_DEBUG) {
    console.error(`[harness] temp dir kept: ${tmpBase}`);
    return;
  }
  rmSync(tmpBase, { recursive: true, force: true });
}

// The plugin persists state under WAM_HOME; a populated directory is direct
// evidence that the plugin actually loaded and executed from the artifact.
// --- Observation helpers ------------------------------------------------

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

/**
 * A failed attempt is transient unless it points at the environment or at the
 * plugin itself: a missing binary or a plugin crash must not be retried.
 * @param {{ timedOut: boolean, spawnError: string | null, pluginError: string | null, code: number, clean: string }} result
 */
function isTransient(result) {
  if (result.spawnError) return false;
  if (result.pluginError) return false;
  if (result.timedOut) return true;
  if (result.code !== 0) return true;
  if (!EXPECTED.test(result.clean)) return true;
  return false;
}

function describeFailure(result) {
  if (result.spawnError) return `spawn error: ${result.spawnError}`;
  if (result.pluginError) return `plugin error: ${result.pluginError}`;
  if (result.timedOut) return "timeout (no model output)";
  if (result.code !== 0) return `exit code ${result.code}`;
  if (!EXPECTED.test(result.clean)) return "expected answer missing";
  return "unknown";
}

// The plugin resolves its state root from `pluginInput.directory ||
// process.cwd()` and never reads WAM_HOME (that variable is not part of the
// runtime contract). The E2E therefore validates the `.wam/` directory the
// real session creates, instead of the unused WAM_HOME target.
function readWamEntries(dir) {
  try {
    return readdirSync(dir);
  } catch (_) {
    return [];
  }
}

function collectWamDirs(root, depth, found) {
  if (depth < 0 || !existsSync(root)) return found;
  let names = [];
  try {
    names = readdirSync(root);
  } catch (_) {
    return found;
  }
  for (const name of names) {
    const full = join(root, name);
    if (name === ".wam") {
      found.push(full);
      continue;
    }
    let stat = null;
    try {
      stat = statSync(full);
    } catch (_) {
      continue;
    }
    if (!stat.isDirectory()) continue;
    if (name === "node_modules" || name === ".git") continue;
    collectWamDirs(full, depth - 1, found);
  }
  return found;
}

/**
 * Locate the `.wam/` state directory produced by the running plugin.
 * @returns {{ dir: string, root: string, entries: string[] } | null}
 */
function findWamStateDir() {
  const dirs = new Set();
  for (const root of [workspace, tmpBase]) {
    const direct = join(root, ".wam");
    if (existsSync(direct)) dirs.add(direct);
  }
  for (const dir of collectWamDirs(tmpBase, 4, [])) dirs.add(dir);
  const candidates = [...dirs].map((dir) => ({
    dir,
    root: dirname(dir),
    entries: readWamEntries(dir),
  }));
  if (candidates.length === 0) return null;
  // Prefer the directory that actually holds state over an empty one.
  candidates.sort((a, b) => b.entries.length - a.entries.length);
  return candidates[0];
}

/**
 * Hook registrations observed by the adapter.
 * @returns {{ on: string[], returned: string[], registered: string[] }}
 */
function readHookRegistrations() {
  const empty = { on: [], returned: [], registered: [] };
  if (!existsSync(hooksPath)) return empty;
  try {
    const parsed = JSON.parse(readFileSync(hooksPath, "utf8"));
    const on = Array.isArray(parsed.on) ? parsed.on.map(String) : [];
    const returned = Array.isArray(parsed.returned) ? parsed.returned.map(String) : [];
    return { on, returned, registered: [...new Set([...on, ...returned])] };
  } catch (_) {
    return empty;
  }
}

function wamStatePresent() {
  try {
    return findWamStateDir() !== null;
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
  // The plugin creates `.wam/` itself (from pluginInput.directory/cwd); the
  // harness must NOT pre-create it, otherwise "created by the plugin" could
  // not be asserted. Clear any state left by a previous attempt instead.
  try {
    rmSync(wamHome, { recursive: true, force: true });
  } catch (_) {}
  try {
    rmSync(join(workspace, ".wam"), { recursive: true, force: true });
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
    // A tool-using prompt is required on purpose: the plugin persists its
    // `.wam/` state from the tool.execute.* hooks, so a pure Q&A session would
    // never create the state directory this E2E has to validate.
    const prompt =
      "Usa la herramienta bash para ejecutar el comando `echo 42` y responde únicamente con el número que imprima.";

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
      if (line.includes("WAM") || line.includes("opencode-wait-a-minute")) {
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
  // `.wam/` is intentionally NOT pre-created: its creation by the plugin is
  // part of what this E2E validates.

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
  // OpenCode's plugin loader requires every named export to be a function;
  // WAM's index.js also exports a non-function (sessionExecutions), so the adapter
  // exposes exactly one default export pointing at the installed `main`.
  //
  // OpenCode 1.18.x resolves `plugin` config entries as npm specs, file paths
  // (relative to the declaring config) or file URLs. `.mjs` is NOT recognized;
  // the adapter is written as `.js` so Bun loads it as ESM.
  // The adapter is also the observation point for hook registration: it wraps
  // `input.plugin` to record `plugin.on(...)` calls and captures the hook map
  // returned by the plugin factory. Both are written to WAM_E2E_HOOKS so the
  // harness can assert that the plugin really registered its hooks.
  const wrapperSource =
    `import fs from "node:fs";\n` +
    `import WaitAMinutePlugin from ${JSON.stringify(installedMain)};\n` +
    `export default async function waitAMinuteE2EEntry(input) {\n` +
    `  const registered = { on: [], returned: [] };\n` +
    `  const record = (kind, name) => {\n` +
    `    try { if (!registered[kind].includes(name)) registered[kind].push(name); } catch (_) {}\n` +
    `  };\n` +
    `  let nextInput = input;\n` +
    `  const api = input && input.plugin;\n` +
    `  if (api && typeof api.on === "function") {\n` +
    `    nextInput = { ...input, plugin: new Proxy(api, {\n` +
    `      get(target, prop, receiver) {\n` +
    `        if (prop === "on") {\n` +
    `          return (name, handler) => { record("on", String(name)); return target.on(name, handler); };\n` +
    `        }\n` +
    `        const value = Reflect.get(target, prop, receiver);\n` +
    `        return typeof value === "function" ? value.bind(target) : value;\n` +
    `      },\n` +
    `    }) };\n` +
    `  }\n` +
    `  if (process.env.WAM_E2E_MARKER) {\n` +
    `    try { fs.writeFileSync(process.env.WAM_E2E_MARKER, "loaded", "utf8"); } catch (_) {}\n` +
    `  }\n` +
    `  const result = await WaitAMinutePlugin(nextInput);\n` +
    `  for (const key of Object.keys(result || {})) record("returned", key);\n` +
    `  if (result && typeof result.hooks === "object") {\n` +
    `    for (const key of Object.keys(result.hooks)) record("returned", key);\n` +
    `  }\n` +
    `  if (process.env.WAM_E2E_HOOKS) {\n` +
    `    try { fs.writeFileSync(process.env.WAM_E2E_HOOKS, JSON.stringify(registered), "utf8"); } catch (_) {}\n` +
    `  }\n` +
    `  return result;\n` +
    `}\n`;
  const pluginEntryPath = join(workspace, "wam-e2e-entry.js");
  writeFileSync(pluginEntryPath, wrapperSource, "utf8");
  log("setup", `wrote plugin adapter at ${pluginEntryPath}`);

  // Step 3b: register the adapter via the project opencode.jsonc `plugin` array.
  const configContent = JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      plugin: ["./wam-e2e-entry.js"],
    },
    null,
    2
  );
  writeFileSync(configPath, configContent, "utf8");
  log("setup", `created temporary opencode config at ${configPath}`);

  // Step 4: isolate HOME/XDG/WAM.
  // PWD/INIT_CWD MUST be overridden too: `spawn` changes the child's working
  // directory but leaves the inherited PWD pointing at the checkout, and
  // OpenCode resolves its project directory from PWD. Without this the session
  // runs against the real repository instead of the isolated workspace and the
  // plugin writes its `.wam/` state into the checkout.
  const env = {
    ...process.env,
    HOME: tmpBase, // so .opencode and .wam are under tmpBase
    PWD: workspace,
    INIT_CWD: workspace,
    XDG_CONFIG_HOME: configHome, // isolate global config
    XDG_DATA_HOME: join(tmpBase, ".local", "share"),
    XDG_STATE_HOME: join(tmpBase, ".local", "state"),
    WAM_HOME: wamHome, // NOTE: the plugin never reads it (state root = directory/cwd)
    WAM_E2E_MARKER: markerPath, // written by the adapter when the installed plugin loads
    WAM_E2E_HOOKS: hooksPath, // hook registrations observed by the adapter
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
  // never exits), occasionally exits non-zero without a plugin error, and
  // sometimes answers without the expected payload. All of those are transient
  // for a live backend, so retry a bounded number of times before failing.
  let result = await runOpencode(env);
  let attempt = 1;
  while (attempt < MAX_ATTEMPTS && isTransient(result)) {
    log(
      "retry",
      `opencode attempt ${attempt}/${MAX_ATTEMPTS} failed transiently (${describeFailure(result)}); retrying in ${RETRY_DELAY_MS}ms`
    );
    await delay(RETRY_DELAY_MS);
    result = await runOpencode(env);
    attempt += 1;
  }
  summary.attempts = attempt;
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

  // Hook registration: the plugin must actually subscribe to the OpenCode
  // hooks, otherwise the gate is inert even though the module loaded.
  const hooks = readHookRegistrations();
  summary.hooks = hooks;
  if (hooks.registered.length === 0) {
    fail(
      "hooks",
      "no hook registration observed (neither plugin.on(...) nor a returned hook map)",
      1
    );
  }
  const missingHooks = EXPECTED_HOOKS.filter((h) => !hooks.registered.includes(h));
  if (missingHooks.length > 0) {
    fail(
      "hooks",
      `expected hook(s) not registered: ${missingHooks.join(", ")} (registered: ${hooks.registered.join(", ") || "none"})`,
      1
    );
  }
  log("hooks", `registered hooks: ${hooks.registered.join(", ")}`);

  // `.wam/` lifecycle: the plugin must create its own state directory and
  // populate it during the session.
  const state = findWamStateDir();
  summary.state = {
    dir: state ? state.dir : null,
    root: state ? state.root : null,
    entries: state ? state.entries : [],
    taskArtifacts: [],
  };
  log(
    "state",
    `searched: ${join(workspace, ".wam")} | ${join(tmpBase, ".wam")} | workspace=[${readdirSync(workspace).join(",")}] | tmpBase=[${readdirSync(tmpBase).join(",")}]`
  );
  if (!state) {
    fail("state", "plugin did not create a .wam/ state directory during the session", 1);
  }
  const lifecycleEntries = state.entries.filter((e) => WAM_STATE_ENTRIES.includes(e));
  if (lifecycleEntries.length === 0) {
    fail(
      "state",
      `.wam/ exists but holds no recognized state (entries: ${state.entries.join(", ") || "none"})`,
      1
    );
  }
  // Task lifecycle: the session must have persisted an active task, either as
  // the active-task pointer, as a per-task directory, or as task state.
  const taskDirsPath = join(state.dir, "tasks");
  const taskDirs = existsSync(taskDirsPath)
    ? readdirSync(taskDirsPath).filter((e) => !e.startsWith("."))
    : [];
  const taskArtifacts = [
    existsSync(join(state.dir, "active-task")) ? "active-task" : null,
    taskDirs.length > 0 ? "tasks/" : null,
    existsSync(join(state.dir, "task-state.json")) ? "task-state.json" : null,
  ].filter(Boolean);
  if (taskArtifacts.length === 0) {
    fail(
      "state",
      `.wam/ holds no task lifecycle artifact (entries: ${state.entries.join(", ") || "none"})`,
      1
    );
  }
  summary.state.taskArtifacts = taskArtifacts;
  log("state", `.wam/ at ${state.dir} -> ${lifecycleEntries.join(", ")}`);

  log(
    "result",
    "round-trip verified: model answered, hooks registered and plugin loaded from the packed artifact"
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
