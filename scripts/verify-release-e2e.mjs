#!/usr/bin/env node
/**
 * Release E2E: installed tarball + isolated test user + real opencode web + Playwright.
 *
 * Contract:
 *   1. Build must already have run (`npm run build`).
 *   2. `npm pack` the working tree.
 *   3. Install the tarball into a throwaway app dir (code comes from the install only).
 *   4. Create an isolated HOME/XDG test user and a fixture project.
 *   5. Start a NEW `opencode web` process as that test user, loading only the
 *      installed package through a thin adapter.
 *   6. Drive the real UI with Playwright (prompt -> assistant response -> render).
 *   7. Assert installed-plugin marker, task artifacts and contract state.
 *
 * Exit codes: 0 pass, 1 required check failed, 2 setup/infrastructure failure.
 */

import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const PKG_NAME = "opencode-wait-a-minute";
const PROMPT =
  "Creá el archivo hello.txt con el texto OK y verificá que exista.";
// Free model pinned for the hermetic gate. The default `big-pickle` can return
// an empty assistant turn and stall the E2E; `beam-free` answers reliably.
const DEFAULT_MODEL = "opencode/beam-free";
const RELEASE_MODEL = process.env.WAM_RELEASE_MODEL || DEFAULT_MODEL;
const RELEASE_BASE_URL = process.env.WAM_RELEASE_BASE_URL || "";
const RELEASE_API_KEY = process.env.WAM_RELEASE_API_KEY || "x";

function parseArgs(argv) {
  const options = { out: "", keep: false, timeout: 300000, serverTimeout: 60000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") options.out = argv[++i] ?? "";
    else if (arg === "--keep") options.keep = true;
    else if (arg === "--timeout") options.timeout = Number(argv[++i] ?? options.timeout);
    else if (arg === "--server-timeout") options.serverTimeout = Number(argv[++i] ?? options.serverTimeout);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(16).slice(2, 10)}`;
const options = parseArgs(process.argv.slice(2));
const reportDir = options.out
  ? resolve(options.out)
  : join(tmpdir(), `wam-release-e2e-${runId}`);
const checks = [];
const timeline = [];
const artifacts = [];

function record(type, detail) {
  timeline.push({ at: new Date().toISOString(), type, detail });
}

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), required: true, detail: String(detail ?? "") });
  record("check", `${name}: ${ok ? "PASS" : "FAIL"} ${detail ?? ""}`.trim());
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${raw.slice(0, 300)}`);
  }
  return raw ? JSON.parse(raw) : null;
}

async function poll(fn, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, intervalMs));
  }
  throw lastError ?? new Error("timeout");
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push("playwright");
  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    candidates.push(join(globalRoot, "playwright"));
  } catch {
    // npm root -g is best effort
  }
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    "Playwright is required for the release E2E. Install it (npm i -g playwright) or set PLAYWRIGHT_MODULE.",
  );
}

function collectText(messages) {
  const out = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    const role = message?.info?.role ?? message?.role;
    if (role !== "assistant") continue;
    for (const part of Array.isArray(message?.parts) ? message.parts : []) {
      if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
        out.push(part.text);
      }
    }
  }
  return out.join("\n").trim();
}

function uiFragment(text) {
  for (const line of text.split(/\r?\n/)) {
    const clean = line
      .replace(/^[#>*\-\s]+/, "")
      .replace(/^[0-9]+\.\s*/, "")
      .replace(/[*_~`]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const letters = (clean.match(/[A-Za-zÁÉÍÓÚáéíóúñÑ]/g) ?? []).length;
    if (clean.length >= 12 && letters >= 8 && !clean.includes("://")) {
      return clean.slice(0, 30);
    }
  }
  return text.replace(/[*_~`#>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
}

function findTaskDir(root) {
  const tasksRoot = join(root, ".wam", "tasks");
  if (!existsSync(tasksRoot)) return null;
  let best = null;
  for (const name of readdirSync(tasksRoot)) {
    const dir = join(tasksRoot, name);
    const taskFile = join(dir, "task.json");
    try {
      const stat = statSync(taskFile);
      if (!stat.isFile()) continue;
      if (!best || stat.mtimeMs > best.mtimeMs) best = { dir, mtimeMs: stat.mtimeMs };
    } catch {
      // ignore partial dirs
    }
  }
  return best ? best.dir : null;
}

function materializeReport(errorMessage, exitCode, extra) {
  const report = {
    schemaVersion: 1,
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    exitCode,
    error: errorMessage,
    options,
    installed: extra.installed ?? null,
    fixture: extra.fixture ?? "",
    testUserHome: extra.testUserHome ?? "",
    server: extra.server ?? null,
    timeline,
    checks,
    artifacts,
  };
  mkdirSync(reportDir, { recursive: true });
  const jsonPath = join(reportDir, "report.json");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# WAM Release E2E",
    "",
    `- Run: \`${runId}\``,
    `- Result: **${exitCode === 0 ? "PASS" : "FAIL"}**`,
    `- Checks: ${checks.filter((c) => c.ok).length}/${checks.length} pass`,
    `- Installed: \`${extra.installed?.dir ?? "n/a"}\``,
    `- Server: \`${extra.server?.baseUrl ?? "n/a"}\` (pid ${extra.server?.pid ?? "n/a"})`,
    `- Fixture: \`${extra.fixture ?? "n/a"}\``,
    `- Test user HOME: \`${extra.testUserHome ?? "n/a"}\``,
    "",
  ];
  if (errorMessage) lines.push(`- Error: ${errorMessage}`, "");
  lines.push("## Checks", "");
  for (const c of checks) lines.push(`- ${c.ok ? "PASS" : "FAIL"} \`${c.name}\` — ${c.detail}`);
  lines.push("", "## Timeline", "");
  for (const t of timeline) lines.push(`- ${t.at} \`${t.type}\` ${t.detail ?? ""}`);
  lines.push("", "## Artifacts", "");
  for (const a of artifacts) lines.push(`- \`${a}\``);
  lines.push("");
  writeFileSync(join(reportDir, "report.md"), `${lines.join("\n")}\n`);
  return { jsonPath, mdPath: join(reportDir, "report.md") };
}

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), "wam-release-e2e-work-"));
  const packDir = join(tmp, "pack");
  const appDir = join(tmp, "app");
  const project = join(tmp, "project");
  const testUserHome = join(tmp, "user");
  const serverLog = join(reportDir, "server.log");
  const markerPath = join(reportDir, "installed-plugin-loaded.marker");
  let server = null;
  let browser = null;
  let serverInfo = null;
  let installed = null;

  const finish = (errorMessage, exitCode) => {
    const paths = materializeReport(errorMessage, exitCode, {
      installed,
      fixture: project,
      testUserHome,
      server: serverInfo,
    });
    artifacts.push(paths.jsonPath, paths.mdPath);
    return paths;
  };

  try {
    log(`[setup] work dir ${tmp}`);

    // 1. Pack the working tree.
    mkdirSync(packDir, { recursive: true });
    execFileSync("npm", ["pack", "--silent", "--pack-destination", packDir], {
      cwd: REPO_ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    const tarballs = readdirSync(packDir).filter((name) => name.endsWith(".tgz"));
    if (tarballs.length !== 1) throw new Error(`expected one tarball, found ${tarballs.length}`);
    const tarball = join(packDir, tarballs[0]);
    check("packed", true, tarball);
    record("pack", tarball);

    // 2. Install into a throwaway app. The fixture will import only this copy.
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      join(appDir, "package.json"),
      `${JSON.stringify({ name: "wam-release-e2e-app", private: true, type: "module" }, null, 2)}\n`,
    );
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", tarball], {
      cwd: appDir,
      stdio: "pipe",
      encoding: "utf8",
    });
    const installedDir = join(appDir, "node_modules", PKG_NAME);
    const installedMain = join(installedDir, "index.js");
    const installedPkg = JSON.parse(readFileSync(join(installedDir, "package.json"), "utf8"));
    installed = { dir: installedDir, version: installedPkg.version, tarball };
    if (!existsSync(installedMain)) throw new Error(`installed entry missing: ${installedMain}`);
    if (installedPkg.name !== PKG_NAME) throw new Error(`identity drift: ${installedPkg.name}`);
    if (installedDir === REPO_ROOT) throw new Error("installed plugin resolves to the checkout");
    check("installed", true, `${installedPkg.name}@${installedPkg.version}`);
    record("install", installedDir);

    // 3. Fixture project + thin adapter that imports the INSTALLED package only.
    mkdirSync(join(project, ".wam"), { recursive: true });
    writeFileSync(
      join(project, "package.json"),
      `${JSON.stringify({ name: "wam-release-e2e-fixture", private: true, type: "module" }, null, 2)}\n`,
    );
    writeFileSync(
      join(project, ".wam", "config.json"),
      `${JSON.stringify(
        {
          logging: true,
          enforcement: true,
          contractApproval: "advisory",
          autoLoop: false,
          taskLoop: {
            enabled: true,
            maxIterations: 10,
            maxNoProgress: 3,
            agents: { enabled: true, maxRevisionCycles: 2, maxReplanCycles: 1, maxHistory: 5, toolTimeoutMs: 300000 },
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(project, "README.md"), "# WAM release E2E fixture\n");
    const adapterPath = join(project, "wam-release-entry.js");
    writeFileSync(
      adapterPath,
      [
        `import plugin from ${JSON.stringify(pathToFileURL(installedMain).href)};`,
        `import { writeFileSync } from "node:fs";`,
        `export default async function WAMReleaseEntry(input) {`,
        `  if (process.env.WAM_RELEASE_MARKER) {`,
        `    try { writeFileSync(process.env.WAM_RELEASE_MARKER, "loaded", "utf8"); } catch {}`,
        `  }`,
        `  return plugin(input);`,
        `}`,
        "",
      ].join("\n"),
    );
    const config = {
      $schema: "https://opencode.ai/config.json",
      model: RELEASE_MODEL,
      plugin: ["./wam-release-entry.js"],
      permission: { edit: "allow", bash: "allow", webfetch: "allow" },
    };
    if (RELEASE_BASE_URL) {
      const [providerId, ...modelParts] = RELEASE_MODEL.split("/");
      const modelId = modelParts.join("/");
      config.provider = {
        [providerId]: {
          npm: "@ai-sdk/openai-compatible",
          name: providerId,
          options: { baseURL: RELEASE_BASE_URL, apiKey: RELEASE_API_KEY },
          models: { [modelId]: { name: modelId } },
        },
      };
    }
    writeFileSync(
      join(project, "opencode.json"),
      `${JSON.stringify(config, null, 2)}\n`,
    );
    try {
      execFileSync("git", ["init", "-q"], { cwd: project, stdio: "ignore" });
      execFileSync("git", ["add", "-A"], { cwd: project, stdio: "ignore" });
      execFileSync(
        "git",
        ["-c", "user.email=wam@example.com", "-c", "user.name=WAM E2E", "commit", "-qm", "fixture"],
        { cwd: project, stdio: "ignore" },
      );
    } catch {
      // git history is best effort
    }
    check("fixture", existsSync(join(project, ".wam", "config.json")), project);
    record("fixture", project);
    record("model", RELEASE_MODEL);

    // 4. Isolated test user (HOME/XDG). No real config or credentials are copied.
    for (const dir of [".config", ".local/share", ".local/state", ".cache"]) {
      mkdirSync(join(testUserHome, dir), { recursive: true });
    }
    check("isolated-test-user", existsSync(testUserHome), testUserHome);
    record("test-user", testUserHome);

    // 5. Start a NEW opencode web instance as the test user.
    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const logFd = openSync(serverLog, "a");
    try {
      server = spawn(process.env.OPENCODE_BIN || "opencode", ["web", "--port", String(port), "--hostname", "127.0.0.1"], {
        cwd: project,
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: {
          ...process.env,
          HOME: testUserHome,
          PWD: project,
          INIT_CWD: project,
          XDG_CONFIG_HOME: join(testUserHome, ".config"),
          XDG_DATA_HOME: join(testUserHome, ".local", "share"),
          XDG_STATE_HOME: join(testUserHome, ".local", "state"),
          XDG_CACHE_HOME: join(testUserHome, ".cache"),
          WAM_LOGGING: "true",
          WAM_LOG_FILE: join(reportDir, "plugin.log"),
          WAM_METRICS_DIR: join(reportDir, "metrics"),
          WAM_SESSION_DIR: join(reportDir, "sessions"),
          WAM_RELEASE_MARKER: markerPath,
          OPENCODE_TELEMETRY_ENABLED: "false",
          OPENCODE_AUTOUPDATE_CHECK: "false",
          CI: "true",
          NO_COLOR: "1",
        },
      });
    } finally {
      closeSync(logFd);
    }
    serverInfo = { pid: server.pid ?? 0, port, baseUrl, logPath: serverLog };
    record("server-spawned", `${baseUrl} pid=${serverInfo.pid}`);
    await poll(() => fetchJson(`${baseUrl}/session`), options.serverTimeout, 500);
    check("server-ready", true, `${baseUrl} pid=${serverInfo.pid}`);
    record("server-ready", baseUrl);

    // 6. Real browser: prompt through the UI, then assert the rendered answer.
    const { chromium } = loadPlaywright();
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: "Add project" }).first().click();
    const openDialog = page.getByRole("dialog", { name: "Open project" });
    await openDialog.waitFor({ state: "visible", timeout: 30000 });
    const folderSearch = openDialog.getByRole("textbox", { name: "Search folders" });
    await folderSearch.click();
    await page.keyboard.type(project, { delay: 25 });
    const projectName = project.split("/").filter(Boolean).pop();
    const projectEntry = openDialog.getByRole("button").filter({ hasText: projectName });
    await poll(
      async () => {
        const text = await openDialog.innerText();
        if (text.includes("Loading")) return null;
        return (await projectEntry.count()) > 0 ? true : null;
      },
      30000,
      250,
    );
    await projectEntry.first().click();
    await openDialog.waitFor({ state: "hidden", timeout: 30000 });
    record("project-opened", project);
    check("project-opened", true, project);

    await page.getByRole("button", { name: "New session" }).first().click();
    const prompt = page.locator('[aria-label="Prompt"]');
    await prompt.waitFor({ state: "visible", timeout: 60000 });
    await prompt.click();
    await page.keyboard.type(PROMPT, { delay: 10 });
    await page.locator('[aria-label="Send"]').click();
    record("playwright-prompt", "sent");
    check("playwright-prompt", true, "prompt submitted through the web UI");

    const session = await poll(
      async () => {
        const sessions = await fetchJson(`${baseUrl}/session?directory=${encodeURIComponent(project)}`);
        const list = Array.isArray(sessions) ? sessions : sessions?.sessions ?? [];
        const ordered = [...list].sort((a, b) => (b?.time?.created ?? 0) - (a?.time?.created ?? 0));
        for (const item of ordered) {
          const messages = await fetchJson(`${baseUrl}/session/${item.id}/message`);
          const text = collectText(Array.isArray(messages) ? messages : messages?.messages);
          if (text) return { id: item.id, text };
        }
        return null;
      },
      options.timeout,
      1500,
    );
    const sessionId = session.id;
    const assistantText = session.text;
    check("session-created", Boolean(sessionId), sessionId);
    record("session", sessionId);
    check("assistant-responded", assistantText.length > 0, `${assistantText.length} chars`);
    const fragment = uiFragment(assistantText);
    try {
      await page.waitForFunction((needle) => document.body.innerText.includes(needle), fragment, { timeout: 90000 });
      check("ui-rendered", true, `rendered fragment: ${fragment}`);
    } catch {
      check("ui-rendered", false, `fragment not found in UI: ${fragment}`);
    }
    const bodyText = await page.locator("body").innerText();
    const bodyPath = join(reportDir, "ui-body.txt");
    writeFileSync(bodyPath, bodyText);
    artifacts.push(bodyPath);
    const screenshotPath = join(reportDir, "ui.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    artifacts.push(screenshotPath);

    // 7. Installed-plugin marker + WAM task artifacts.
    check("installed-plugin-loaded", existsSync(markerPath), markerPath);
    const taskDir = await poll(() => findTaskDir(project), 60000, 500).catch(() => null);
    check("task-state", Boolean(taskDir), taskDir ?? "no .wam/tasks/*/task.json");
    if (taskDir) {
      const taskFile = join(taskDir, "task.json");
      const task = JSON.parse(readFileSync(taskFile, "utf8"));
      const contractStatus = task?.contract?.status ?? null;
      check(
        "contract-not-rejected",
        contractStatus !== null && contractStatus !== "REJECTED",
        `contract.status=${contractStatus ?? "null"}`,
      );
      const copyPath = join(reportDir, "task.json");
      writeFileSync(copyPath, `${JSON.stringify(task, null, 2)}\n`);
      artifacts.push(copyPath);
    } else {
      check("contract-not-rejected", false, "no task");
    }

    for (const file of [serverLog, join(reportDir, "plugin.log")]) {
      if (existsSync(file)) artifacts.push(file);
    }

    const exitCode = checks.some((item) => item.required && !item.ok) ? 1 : 0;
    const paths = finish(null, exitCode);
    log(`[report] ${paths.mdPath}`);
    log(exitCode === 0 ? "[done] RELEASE E2E PASSED" : "[fail] RELEASE E2E FAILED");
    process.exitCode = exitCode;
  } catch (error) {
    record("error", error?.stack ?? String(error));
    const paths = finish(error?.message ?? String(error), 2);
    log(`[report] ${paths.mdPath}`);
    log(`[fail] ${error?.message ?? error}`);
    process.exitCode = 2;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // best effort
      }
    }
    if (server?.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        try {
          server.kill("SIGTERM");
        } catch {
          // best effort
        }
      }
    }
    if (!options.keep) {
      try {
        rmSync(tmp, { recursive: true, force: true });
      } catch {
        // best effort
      }
    } else {
      log(`[keep] fixture kept at ${tmp}`);
    }
  }
}

main();
