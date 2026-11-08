#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const SKILL_MARKERS = ["codebase-design", "writing-for-agents", "dietrichgebert-ponytail"];

export const DEFAULT_PROMPT =
  "Implementá add.js con una función que sume dos números y add.test.mjs usando node:test. Verificá con node --test add.test.mjs.";

export interface RunOptions {
  port: number;
  out: string;
  ephemeral: boolean;
  keep: boolean;
  autoApprove: boolean;
  timeout: number;
  serverTimeout: number;
  prompt: string;
  model: string;
  help: boolean;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  role: string | null;
  parentID: string | null;
  messageCount: number;
  lastAssistantFinish: string | null;
  error: string | null;
  lastTextExcerpt: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface TimelineEvent {
  at: string;
  type: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface Environment {
  node: string;
  opencode: string;
  gitHead: string;
  gitDirty: boolean;
  platform: string;
}

export interface ServerInfo {
  pid: number;
  port: number;
  baseUrl: string;
  logPath: string;
}

export interface SessionInfo {
  id: string | null;
  prompt: string;
  approvalPrompt: string;
}

export interface RunReport {
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number;
  error: string | null;
  options: RunOptions;
  environment: Environment;
  fixturePath: string;
  reportDir: string;
  server: ServerInfo;
  session: SessionInfo;
  mainSession?: any;
  timeline: TimelineEvent[];
  task: any;
  loop: any;
  sessions: SessionSummary[];
  checks: CheckResult[];
  artifacts: string[];
  logTail: string;
}

export interface CheckInput {
  serverReady: boolean;
  sessionId: string | null;
  contractStatus: string | null;
  contractApproval?: string;
  task: any;
  loop: any;
  sessions: SessionSummary[];
  mainSessionText?: string;
  taskFileExists: boolean;
  loopFileExists: boolean;
}

export function parseArgs(argv: string[]): RunOptions {
  const options: RunOptions = {
    port: 0,
    out: "",
    ephemeral: false,
    keep: false,
    autoApprove: true,
    timeout: 240000,
    serverTimeout: 30000,
    prompt: DEFAULT_PROMPT,
    model: "",
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--port":
        options.port = readNumber(argv, ++i, arg);
        break;
      case "--out":
        options.out = readValue(argv, ++i, arg);
        break;
      case "--ephemeral":
        options.ephemeral = true;
        break;
      case "--keep":
        options.keep = true;
        break;
      case "--auto-approve":
        options.autoApprove = true;
        break;
      case "--no-auto-approve":
        options.autoApprove = false;
        break;
      case "--timeout":
        options.timeout = readNumber(argv, ++i, arg);
        break;
      case "--server-timeout":
        options.serverTimeout = readNumber(argv, ++i, arg);
        break;
      case "--prompt":
        options.prompt = readValue(argv, ++i, arg);
        break;
      case "--model":
        options.model = readValue(argv, ++i, arg);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function readNumber(argv: string[], index: number, flag: string): number {
  const raw = readValue(argv, index, flag);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid value for ${flag}: ${raw}`);
  }
  return value;
}

export function buildFixtureConfig(): string {
  const config = {
    logging: true,
    enforcement: true,
    contractApproval: "advisory",
    autoLoop: false,
    taskLoop: {
      enabled: true,
      maxIterations: 10,
      maxNoProgress: 3,
      agents: {
        enabled: true,
        maxRevisionCycles: 2,
        maxReplanCycles: 1,
        maxHistory: 5,
        toolTimeoutMs: 300000,
      },
    },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function pickTaskDir(taskRoot: string, known: Set<string> = new Set()): string | null {
  const tasksRoot = path.join(taskRoot, ".wam", "tasks");
  let entries: string[];
  try {
    entries = readdirSync(tasksRoot);
  } catch {
    return null;
  }

  let best: { dir: string; mtimeMs: number } | null = null;
  for (const name of entries) {
    const dir = path.join(tasksRoot, name);
    if (known.has(name) || known.has(dir)) continue;
    const file = path.join(dir, "task.json");
    try {
      const stat = statSync(file);
      if (!stat.isFile()) continue;
      if (!best || stat.mtimeMs > best.mtimeMs) best = { dir, mtimeMs: stat.mtimeMs };
    } catch {
      continue;
    }
  }

  return best ? best.dir : null;
}

export function evaluateChecks(input: CheckInput): CheckResult[] {
  const agentRun = input.task?.agentRun ?? {};
  const gate = input.task?.executionGate ?? {};
  const requirements = Array.isArray(input.task?.requirements) ? input.task.requirements : [];
  const phase = input.task?.phase ?? null;
  const status = agentRun.status ?? null;
  const failureReason = typeof agentRun.failureReason === "string" ? agentRun.failureReason : "";
  const contractStatus = input.contractStatus ?? input.task?.contract?.status ?? null;
  const contractApproval = input.contractApproval ?? "advisory";
  const allRequirementsDone = requirements.every(
    (req: any) => req?.status === "verified" || req?.status === "done",
  );
  const agentRan =
    (Array.isArray(agentRun.results) && agentRun.results.length > 0) ||
    input.sessions.some(
      (session) =>
        session.parentID != null &&
        typeof session.title === "string" &&
        session.title.startsWith("WAM "),
    );
  const settled = gate?.active !== true && status !== null;
  const failed = status === "FAILED" || status === "BLOCKED";

  return [
    {
      name: "server-ready",
      ok: input.serverReady,
      required: true,
      detail: input.serverReady ? "server answered GET /session" : "server never became ready",
    },
    {
      name: "session-created",
      ok: input.sessionId !== null && input.sessionId !== "",
      required: true,
      detail: input.sessionId ?? "no session id",
    },
    {
      name: "contract-approved",
      ok: contractStatus === "APPROVED" || (contractApproval !== "required" && contractStatus !== null && contractStatus !== "REJECTED"),
      required: true,
      detail: `contract.status=${contractStatus ?? "null"} approval=${contractApproval}`,
    },
    {
      name: "agent-pass-ran",
      ok: agentRan,
      required: true,
      detail: agentRan ? "agent results or WAM child session present" : "no agent results or WAM child session",
    },
    {
      name: "agent-pass-settled",
      ok: settled,
      required: true,
      detail: `gate.active=${String(gate?.active)} agentRun.status=${status ?? "null"}`,
    },
    {
      name: "loop-complete",
      ok: phase === "DONE" && allRequirementsDone,
      required: true,
      detail: `phase=${phase ?? "null"} requirements=${requirements.length}`,
    },
    {
      name: "failure-surfaced",
      ok: failed ? failureReason.length > 0 && agentRun.surfaced !== false : true,
      required: true,
      detail: failed
        ? `status=${status} reason=${failureReason || "empty"} surfaced=${String(agentRun.surfaced)}`
        : "no failed/blocked run",
    },
    {
      name: "no-empty-response",
      ok: !failureReason.includes("agent response is empty") && (!failed || failureReason.length > 0),
      required: true,
      detail: failureReason.includes("agent response is empty")
        ? "failureReason mentions an empty agent response"
        : failed && failureReason.length === 0
          ? "failed run has an empty failureReason"
          : "no empty-response failure",
    },
    {
      name: "artifacts-present",
      ok: input.taskFileExists && input.loopFileExists,
      required: true,
      detail: `task.json=${input.taskFileExists} loop-state.json=${input.loopFileExists}`,
    },
    {
      name: "skills-injected",
      ok: SKILL_MARKERS.some((name) => (input.mainSessionText ?? "").includes(name)),
      required: true,
      detail: (() => {
        const found = SKILL_MARKERS.filter((name) => (input.mainSessionText ?? "").includes(name));
        return found.length ? `skills=${found.join(",")}` : "no skill markers in main session";
      })(),
    },
    {
      name: "roles-observed",
      ok: new Set(input.sessions.map((s) => s.role).filter(Boolean)).size >= 2,
      required: true,
      detail: (() => {
        const roles = [...new Set(input.sessions.map((s) => s.role).filter(Boolean))];
        return roles.length ? `roles=${roles.join(",")}` : "fewer than 2 role sessions";
      })(),
    },
  ];
}

export function redactSecrets(text: string): string {
  let out = text;
  out = out.replace(/(authorization\s*[:=]\s*)([^\r\n]+)/gi, "$1[REDACTED]");
  out = out.replace(/((?:api[-_]?key|secret|password)\s*[:=]\s*)([^\s,;}\r\n]+)/gi, "$1[REDACTED]");
  out = out.replace(/(bearer\s+)([A-Za-z0-9._~+/=-]+)/gi, "$1[REDACTED]");
  out = out.replace(
    /("(?:access_token|refresh_token|id_token|token|apiToken|authToken)"\s*:\s*)"[^"]*"/gi,
    '$1"[REDACTED]"',
  );
  out = out.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
  out = out.replace(/\bo1_[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]");
  return out;
}

function collectAllText(messages: any[]): string {
  const out: string[] = [];
  for (const msg of Array.isArray(messages) ? messages : []) {
    for (const part of Array.isArray(msg?.parts) ? msg.parts : []) {
      if (part?.type === "text" && typeof part.text === "string") out.push(part.text);
    }
  }
  return out.join("\n");
}

export function summarizeSession(session: any, messages: any[]): SessionSummary {
  const title = typeof session?.title === "string" ? session.title : "";
  const roleMatch = /^WAM\s+([A-Z][A-Z_-]*)/.exec(title);
  const list = Array.isArray(messages) ? messages : [];

  let lastAssistant: any = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.info?.role === "assistant") {
      lastAssistant = list[i];
      break;
    }
  }

  const info = lastAssistant?.info ?? {};
  const parts = Array.isArray(lastAssistant?.parts) ? lastAssistant.parts : [];
  const text = parts
    .filter((part: any) => part?.type === "text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n");
  const rawError = info.error;
  const error = rawError
    ? typeof rawError === "string"
      ? rawError
      : rawError?.data?.message ?? rawError?.message ?? JSON.stringify(rawError)
    : null;

  return {
    id: String(session?.id ?? ""),
    title,
    role: roleMatch ? roleMatch[1] : null,
    parentID: session?.parentID ?? null,
    messageCount: list.length,
    lastAssistantFinish: info.finish ?? null,
    error,
    lastTextExcerpt: text.slice(0, 500),
    createdAt: session?.time?.created ?? null,
    updatedAt: session?.time?.updated ?? null,
  };
}

function mdCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

export function renderMarkdown(report: RunReport): string {
  const lines: string[] = [];
  const passed = report.checks.filter((check) => check.ok).length;

  lines.push("# WAM web E2E", "");
  lines.push(`- Run: \`${report.runId}\``);
  lines.push(`- Result: **${report.exitCode === 0 ? "PASS" : "FAIL"}**`);
  lines.push(`- Checks: ${passed}/${report.checks.length} passed`);
  lines.push(`- Duration: ${report.durationMs} ms`);
  if (report.error) lines.push(`- Error: ${mdCell(report.error)}`);
  lines.push("");

  lines.push("## Environment", "", "| Key | Value |", "| --- | --- |");
  lines.push(`| node | ${mdCell(report.environment.node)} |`);
  lines.push(`| opencode | ${mdCell(report.environment.opencode)} |`);
  lines.push(`| git head | ${mdCell(report.environment.gitHead)} |`);
  lines.push(`| git dirty | ${String(report.environment.gitDirty)} |`);
  lines.push(`| platform | ${mdCell(report.environment.platform)} |`);
  lines.push("");

  lines.push("## Fixture and server", "");
  lines.push(`- Fixture: \`${report.fixturePath}\``);
  lines.push(`- Report: \`${report.reportDir}\``);
  lines.push(`- Server: ${report.server.baseUrl} (pid ${report.server.pid}, port ${report.server.port})`);
  lines.push(`- Server log: \`${report.server.logPath}\``);
  lines.push(`- Session: \`${report.session.id ?? "n/a"}\``);
  lines.push(`- Prompt: ${mdCell(report.session.prompt)}`);
  lines.push(`- Approval prompt: \`${report.session.approvalPrompt}\``);
  lines.push("");

  lines.push("## Checks", "", "| Check | Result | Detail |", "| --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(`| ${check.name} | ${check.ok ? "PASS" : "FAIL"} | ${mdCell(check.detail)} |`);
  }
  if (report.checks.length === 0) lines.push("| n/a | n/a | no checks recorded |");
  lines.push("");

  lines.push("## Timeline", "", "| At | Event | Detail |", "| --- | --- | --- |");
  for (const event of report.timeline) {
    lines.push(`| ${mdCell(event.at)} | ${mdCell(event.type)} | ${mdCell(event.detail)} |`);
  }
  if (report.timeline.length === 0) lines.push("| n/a | n/a | no events recorded |");
  lines.push("");

  lines.push("## Roles", "", "| Role | Title | Messages | Finish | Error |", "| --- | --- | --- | --- | --- |");
  for (const session of report.sessions) {
    lines.push(
      `| ${mdCell(session.role ?? "n/a")} | ${mdCell(session.title)} | ${session.messageCount} | ${mdCell(
        session.lastAssistantFinish ?? "n/a",
      )} | ${mdCell(session.error ?? "")} |`,
    );
  }
  if (report.sessions.length === 0) lines.push("| n/a | n/a | 0 | n/a | no sessions collected |");
  lines.push("");

  lines.push("## Artifacts", "");
  for (const artifact of report.artifacts) lines.push(`- \`${artifact}\``);
  if (report.artifacts.length === 0) lines.push("- none");
  lines.push("");

  lines.push("## Log tail", "", "```text", redactSecrets(report.logTail).replace(/```/g, "` ` `"), "```", "");

  return lines.join("\n");
}

export function exitCodeFor(checks: CheckResult[]): 0 | 1 {
  return checks.some((check) => check.required && !check.ok) ? 1 : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso(): string {
  return new Date().toISOString();
}

function printUsage(): void {
  console.log(`Usage: node scripts/verify-web-e2e.ts [options]

Options:
  --port <n>             opencode web port (default: 0, pick a free port)
  --out <dir>            report directory (default: openspec/evidence/web-e2e/<runId>)
  --ephemeral            write the report under the OS temp directory instead
  --keep                 keep the fixture project after the run
  --auto-approve         approve the WAM contract automatically (default)
  --no-auto-approve      stop when the contract is PROPOSED
  --timeout <ms>         task-loop timeout (default: 240000)
  --server-timeout <ms>  server boot timeout (default: 30000)
  --prompt <text>        prompt sent to the session
  --model <provider/model>  optional model override
  --help                 show this help`);
}

export function nodeSupportsTypeStripping(version: string): boolean {
  const [major, minor] = version.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 6);
}

export function defaultReportDir(
  runId: string,
  ephemeral: boolean,
  cwd: string = process.cwd(),
): string {
  if (ephemeral) return path.join(os.tmpdir(), "wam-web-e2e", runId);
  return path.join(cwd, "openspec", "evidence", "web-e2e", runId);
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function pollUntil(
  fn: () => Promise<boolean> | boolean,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function fetchJson(url: string, init?: any): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function readJson(file: string): any {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function modelBody(model: string): Record<string, unknown> | null {
  if (!model) return null;
  const slash = model.indexOf("/");
  if (slash <= 0 || slash === model.length - 1) {
    throw new Error(`--model must be provider/model, got: ${model}`);
  }
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}

async function sendMessage(
  baseUrl: string,
  sessionId: string,
  text: string,
  timeoutMs: number,
  model: Record<string, unknown> | null,
): Promise<{ timedOut: boolean; response: any }> {
  const body: any = { parts: [{ type: "text", text }] };
  if (model) body.model = model;
  try {
    const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} sending prompt: ${raw.slice(0, 300)}`);
    }
    return { timedOut: false, response: raw ? JSON.parse(raw) : null };
  } catch (err) {
    const name = (err as any)?.name;
    if (name === "AbortError" || name === "TimeoutError") {
      return { timedOut: true, response: null };
    }
    throw err;
  }
}

async function sendCommand(
  baseUrl: string,
  sessionId: string,
  command: string,
  args: string,
  timeoutMs: number,
): Promise<{ timedOut: boolean; response: any }> {
  try {
    const response = await fetch(`${baseUrl}/session/${sessionId}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, arguments: args }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} sending command: ${raw.slice(0, 300)}`);
    }
    return { timedOut: false, response: raw ? JSON.parse(raw) : null };
  } catch (err) {
    const name = (err as any)?.name;
    if (name === "AbortError" || name === "TimeoutError") {
      return { timedOut: true, response: null };
    }
    throw err;
  }
}

function taskPaths(taskDir: string): { taskFile: string; loopFile: string; eventsFile: string } {
  return {
    taskFile: path.join(taskDir, "task.json"),
    loopFile: path.join(taskDir, "execution", "loop-state.json"),
    eventsFile: path.join(taskDir, "execution", "loop-events.jsonl"),
  };
}

function isTerminal(task: any, loop: any): boolean {
  const requirements = Array.isArray(task?.requirements) ? task.requirements : [];
  const allDone = requirements.every(
    (req: any) => req?.status === "verified" || req?.status === "done",
  );
  const status = task?.agentRun?.status;
  if (task?.phase === "DONE" && allDone) return true;
  if ((status === "FAILED" || status === "BLOCKED") && task?.executionGate?.active !== true) {
    return true;
  }
  return loop?.lastDecision === "COMPLETE";
}

function fingerprint(task: any, loop: any): string {
  const requirements = Array.isArray(task?.requirements)
    ? task.requirements.map((req: any) => `${req?.id}:${req?.status}`)
    : [];
  return JSON.stringify({
    phase: task?.phase ?? null,
    contract: task?.contract?.status ?? null,
    gateActive: task?.executionGate?.active ?? null,
    agentStatus: task?.agentRun?.status ?? null,
    requirements,
    decision: loop?.lastDecision ?? null,
  });
}

async function stopServer(server: any): Promise<void> {
  if (!server || server.exitCode !== null) return;
  const pid = server.pid;
  try {
    if (pid) process.kill(-pid, "SIGTERM");
    else server.kill("SIGTERM");
  } catch {
    try {
      server.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  const deadline = Date.now() + 3000;
  while (server.exitCode === null && Date.now() < deadline) await sleep(100);
  if (server.exitCode === null) {
    try {
      if (pid) process.kill(-pid, "SIGKILL");
      else server.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
  await sleep(100);
}

function redactFile(file: string): string {
  const redacted = redactSecrets(readFileSync(file, "utf8"));
  writeFileSync(file, redacted);
  return redacted;
}

function finalizeLogs(reportDir: string): { logTail: string; artifacts: string[] } {
  const artifacts: string[] = [];
  const chunks: string[] = [];
  for (const file of [path.join(reportDir, "server.log"), path.join(reportDir, "plugin.log")]) {
    if (!existsSync(file)) continue;
    chunks.push(redactFile(file));
    artifacts.push(file);
  }
  const metricsDir = path.join(reportDir, "metrics");
  if (existsSync(metricsDir)) {
    for (const name of readdirSync(metricsDir)) {
      const file = path.join(metricsDir, name);
      if (statSync(file).isFile()) redactFile(file);
    }
  }
  const lines = chunks.join("\n").split(/\r?\n/);
  return { logTail: lines.slice(-200).join("\n"), artifacts };
}

export function collectArtifacts(taskDir: string, reportDir: string, sessions: SessionSummary[]): string[] {
  const artifacts: string[] = [];
  const { taskFile, loopFile, eventsFile } = taskPaths(taskDir);
  const copies: Array<[string, string]> = [
    [taskFile, "task.json"],
    [loopFile, "loop-state.json"],
    [eventsFile, "loop-events.jsonl"],
  ];
  for (const [source, name] of copies) {
    if (!existsSync(source)) continue;
    const destination = path.join(reportDir, name);
    writeFileSync(destination, redactSecrets(readFileSync(source, "utf8")));
    artifacts.push(destination);
  }
  const sessionsFile = path.join(reportDir, "sessions.json");
  writeFileSync(sessionsFile, redactSecrets(`${JSON.stringify(sessions, null, 2)}\n`));
  artifacts.push(sessionsFile);
  return artifacts;
}

function collectEnvironment(): Environment {
  const opencode = spawnSync(process.env.OPENCODE_BIN || "opencode", ["--version"], {
    encoding: "utf8",
    timeout: 5000,
  });
  const gitHead = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  return {
    node: process.versions.node,
    opencode:
      opencode.status === 0 && opencode.stdout ? opencode.stdout.trim() : "unavailable",
    gitHead: gitHead.status === 0 && gitHead.stdout ? gitHead.stdout.trim() : "unknown",
    gitDirty: Boolean(gitStatus.status === 0 && gitStatus.stdout && gitStatus.stdout.trim()),
    platform: `${process.platform} ${process.arch}`,
  };
}

export async function main(): Promise<void> {
  let options: RunOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error)?.message ?? String(err));
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printUsage();
    return;
  }

  if (!nodeSupportsTypeStripping(process.versions.node)) {
    console.error(
      `verify-web-e2e requires Node >= 22.6 for TypeScript type stripping; found ${process.versions.node}`,
    );
    process.exitCode = 2;
    return;
  }

  const startedAt = new Date();
  const startedMs = startedAt.getTime();
  const runId = `${startedAt.toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
  const reportDir = options.out
    ? path.resolve(options.out)
    : defaultReportDir(runId, options.ephemeral);
  const approvalPrompt = "/wam contract approve";
  const contractApproval = "advisory";
  const timeline: TimelineEvent[] = [];

  let fixture = "";
  let server: any = null;
  let spawnError: Error | null = null;
  let taskDir = "";
  let task: any = null;
  let loop: any = null;
  let sessions: SessionSummary[] = [];
  let taskFileExists = false;
  let loopFileExists = false;
  let sessionId: string | null = null;
  let serverInfo: ServerInfo = {
    pid: 0,
    port: 0,
    baseUrl: "",
    logPath: path.join(reportDir, "server.log"),
  };
  let checks: CheckResult[] = [];
  let exitCode: number = 0;
  let errorMessage: string | null = null;
  let logTail = "";
  let artifacts: string[] = [];
  let mainSession: any = null;

  const record = (type: string, detail?: string, data?: Record<string, unknown>): void => {
    timeline.push({ at: nowIso(), type, detail, data });
  };

  try {
    mkdirSync(reportDir, { recursive: true });
    fixture = mkdtempSync(path.join(os.tmpdir(), "wam-web-e2e-fixture-"));
    mkdirSync(path.join(fixture, ".wam"), { recursive: true });
    writeFileSync(path.join(fixture, ".wam", "config.json"), buildFixtureConfig());
    writeFileSync(path.join(fixture, "README.md"), "# WAM web E2E fixture\n");
    writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify({ type: "module", scripts: { test: "node --test add.test.mjs" } }, null, 2)}\n`,
    );
    try {
      spawnSync("git", ["init", "-q"], { cwd: fixture, stdio: "ignore" });
      spawnSync("git", ["add", "-A"], { cwd: fixture, stdio: "ignore" });
      spawnSync(
        "git",
        ["-c", "user.email=wam@example.com", "-c", "user.name=WAM E2E", "commit", "-qm", "fixture"],
        { cwd: fixture, stdio: "ignore" },
      );
    } catch {
      // fixture git history is best effort
    }

    const port = options.port || (await getFreePort());
    const baseUrl = `http://127.0.0.1:${port}`;
    serverInfo = {
      pid: 0,
      port,
      baseUrl,
      logPath: path.join(reportDir, "server.log"),
    };
    const logFd = openSync(serverInfo.logPath, "a");
    try {
      server = spawn(
        process.env.OPENCODE_BIN || "opencode",
        ["web", "--port", String(port), "--hostname", "127.0.0.1"],
        {
          cwd: fixture,
          detached: true,
          stdio: ["ignore", logFd, logFd],
          env: {
            ...process.env,
            WAM_LOGGING: "true",
            WAM_LOG_FILE: path.join(reportDir, "plugin.log"),
            WAM_METRICS_DIR: path.join(reportDir, "metrics"),
            WAM_SESSION_DIR: path.join(reportDir, "sessions"),
            CI: "true",
            NO_COLOR: "1",
          },
        },
      );
    } finally {
      closeSync(logFd);
    }
    serverInfo.pid = server.pid ?? 0;
    server.on("error", (err: Error) => {
      spawnError = err;
    });
    record("server-spawned", `${baseUrl} pid=${serverInfo.pid}`);

    const ready = await pollUntil(async () => {
      if (spawnError) throw spawnError;
      if (server.exitCode !== null) {
        throw new Error(`opencode web exited with code ${server.exitCode}`);
      }
      try {
        const response = await fetch(`${baseUrl}/session`, {
          signal: AbortSignal.timeout(2000),
        });
        await response.text();
        return response.status === 200;
      } catch {
        return false;
      }
    }, options.serverTimeout, 250);

    if (!ready) {
      throw new Error(`opencode web did not become ready within ${options.serverTimeout} ms`);
    }
    record("server-ready", baseUrl);

    const created = await fetchJson(`${baseUrl}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: `WAM web e2e ${runId}` }),
    });
    sessionId = created?.id ?? null;
    if (!sessionId) throw new Error("session creation returned no id");
    record("session-created", sessionId);

    const model = modelBody(options.model);
    const promptTimeout = Math.min(options.timeout, 180000);
    const promptResult = await sendMessage(
      baseUrl,
      sessionId,
      options.prompt,
      promptTimeout,
      model,
    );
    if (promptResult.timedOut) {
      record("prompt-request-timeout", `client timeout after ${promptTimeout} ms`);
    }
    record("prompt-sent", options.prompt);

    const known = new Set<string>();
    const found = await pollUntil(() => Boolean(pickTaskDir(fixture, known)), 30000, 250);
    taskDir = found ? pickTaskDir(fixture, known) ?? "" : "";
    if (!taskDir) throw new Error("WAM task directory was not created within 30 s");
    record("task-detected", taskDir);

    let { taskFile, loopFile } = taskPaths(taskDir);
    task = readJson(taskFile);
    taskFileExists = existsSync(taskFile);
    loopFileExists = existsSync(loopFile);

    let approvalSent = false;
    let stopPolling = false;
    const approve = async (): Promise<void> => {
      if (!options.autoApprove) {
        record("contract-approval-skipped", "contract is PROPOSED and --no-auto-approve was set");
        stopPolling = true;
        return;
      }
      const result = await sendCommand(
        baseUrl,
        sessionId as string,
        "wam",
        "contract approve",
        promptTimeout,
      );
      if (result.timedOut) {
        record("approval-request-timeout", `client timeout after ${promptTimeout} ms`);
      }
      approvalSent = true;
      record("contract-approved", approvalPrompt);
    };

    if (contractApproval === "required" && task?.contract?.status === "PROPOSED") await approve();

    let lastFingerprint = "";
    if (!stopPolling) {
      const deadline = Date.now() + options.timeout;
      while (Date.now() < deadline) {
        task = readJson(taskFile) ?? task;
        loop = readJson(loopFile) ?? loop;
        taskFileExists = existsSync(taskFile);
        loopFileExists = existsSync(loopFile);

        if (contractApproval === "required" && task?.contract?.status === "PROPOSED" && !approvalSent) {
          await approve();
          if (stopPolling) break;
        }

        const current = fingerprint(task, loop);
        if (current !== lastFingerprint) {
          lastFingerprint = current;
          record("loop-snapshot", current);
        }

        if (isTerminal(task, loop)) break;
        await sleep(1000);
      }
    }

    task = readJson(taskFile) ?? task;
    loop = readJson(loopFile) ?? loop;
    taskFileExists = existsSync(taskFile);
    loopFileExists = existsSync(loopFile);
    record(
      "loop-settled",
      `phase=${task?.phase ?? "null"} decision=${loop?.lastDecision ?? "null"}`,
    );

    const sessionList = await fetchJson(`${baseUrl}/session`).catch(() => []);
    const childSessions = (Array.isArray(sessionList) ? sessionList : []).filter(
      (item: any) =>
        item?.id !== sessionId &&
        (item?.parentID === sessionId ||
          (item?.parentID != null &&
            typeof item?.title === "string" &&
            item.title.startsWith("WAM "))),
    );
    for (const child of childSessions.slice(0, 12)) {
      try {
        const messages = await fetchJson(`${baseUrl}/session/${child.id}/message`);
        sessions.push(summarizeSession(child, Array.isArray(messages) ? messages : []));
      } catch {
        sessions.push(summarizeSession(child, []));
      }
    }

    let mainMessagesRaw: any[] = [];
    let mainSessionText = "";
    try {
      const mainMessages = await fetchJson(`${baseUrl}/session/${sessionId}/message`);
      mainMessagesRaw = Array.isArray(mainMessages) ? mainMessages : [];
      mainSessionText = collectAllText(mainMessagesRaw);
      mainSession = {
        id: sessionId,
        messageCount: mainMessagesRaw.length,
        textChars: mainSessionText.length,
        skills: SKILL_MARKERS.filter((name) => mainSessionText.includes(name)),
      };
    } catch {}
    checks = evaluateChecks({
      serverReady: true,
      sessionId,
      contractStatus: task?.contract?.status ?? null,
      contractApproval: "advisory",
      task,
      loop,
      sessions,
      mainSessionText,
      taskFileExists,
      loopFileExists,
    });
    exitCode = exitCodeFor(checks);
    artifacts = collectArtifacts(taskDir, reportDir, sessions);
    if (mainMessagesRaw.length > 0) {
      const mainSessionPath = path.join(reportDir, "main-session.json");
      writeFileSync(mainSessionPath, `${JSON.stringify(mainMessagesRaw, null, 2)}\n`);
      artifacts.push(mainSessionPath);
    }
  } catch (err) {
    errorMessage = (err as Error)?.message ?? String(err);
    exitCode = 2;
    record("error", errorMessage);
    checks = evaluateChecks({
      serverReady: serverInfo.baseUrl !== "",
      sessionId,
      contractStatus: task?.contract?.status ?? null,
      contractApproval: "advisory",
      task,
      loop,
      sessions,
      taskFileExists,
      loopFileExists,
    });
    if (taskDir) {
      try {
        artifacts = collectArtifacts(taskDir, reportDir, sessions);
      } catch {
        // artifact collection is best effort on failure
      }
    }
  } finally {
    if (server) {
      await stopServer(server);
      record("server-stopped", `pid=${serverInfo.pid}`);
    }
    const finalized = finalizeLogs(reportDir);
    logTail = finalized.logTail;
    for (const file of finalized.artifacts) {
      if (!artifacts.includes(file)) artifacts.push(file);
    }
    if (fixture && !options.keep) {
      try {
        rmSync(fixture, { recursive: true, force: true });
      } catch {
        // fixture cleanup is best effort
      }
    }
  }

  const finishedAt = new Date();
  const report: RunReport = {
    schemaVersion: 1,
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedMs,
    exitCode,
    error: errorMessage,
    options,
    environment: collectEnvironment(),
    fixturePath: fixture,
    reportDir,
    server: serverInfo,
    session: { id: sessionId, prompt: options.prompt, approvalPrompt },
    timeline,
    task,
    loop,
    sessions,
    mainSession,
    checks,
    artifacts,
    logTail,
  };

  const jsonPath = path.join(reportDir, "report.json");
  const markdownPath = path.join(reportDir, "report.md");
  try {
    writeFileSync(jsonPath, redactSecrets(`${JSON.stringify(report, null, 2)}\n`));
    writeFileSync(markdownPath, redactSecrets(renderMarkdown(report)));
  } catch (err) {
    console.error(`could not write report: ${(err as Error)?.message ?? String(err)}`);
  }

  const passed = checks.filter((check) => check.ok).length;
  console.log(`WAM web E2E ${exitCode === 0 ? "PASS" : "FAIL"}`);
  console.log(`runId: ${runId}`);
  console.log(`checks: ${passed}/${checks.length} passed`);
  console.log(`report: ${markdownPath}`);
  if (errorMessage) console.error(`error: ${errorMessage}`);
  process.exitCode = exitCode;
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 2;
  });
}
