import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  DEFAULT_PROMPT,
  buildFixtureConfig,
  collectArtifacts,
  defaultReportDir,
  evaluateChecks,
  exitCodeFor,
  parseArgs,
  pickTaskDir,
  redactSecrets,
  renderMarkdown,
  summarizeSession,
} from "../../scripts/verify-web-e2e.ts";

const tempRoots = [];
function tempRoot() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "wam-verify-web-test-"));
  tempRoots.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempRoots) rmSync(dir, { recursive: true, force: true });
});

function checkByName(checks, name) {
  const check = checks.find((item) => item.name === name);
  assert.ok(check, `missing check ${name}`);
  return check;
}

function baseInput(overrides = {}) {
  return {
    serverReady: true,
    sessionId: "ses_123",
    contractStatus: "APPROVED",
    task: {
      phase: "DONE",
      contract: { status: "APPROVED" },
      requirements: [
        { id: "r1", status: "verified", evidence: "node --test add.test.mjs" },
        { id: "r2", status: "done" },
      ],
      agentRun: {
        status: "COMPLETE",
        verdict: "PASS",
        failureReason: null,
        surfaced: true,
        results: [
          { role: "ANALYST", status: "DONE" },
          { role: "BUILDER", status: "DONE" },
        ],
      },
      executionGate: { active: false, reason: "complete", startedAt: 1, completedAt: 2 },
    },
    loop: { lastDecision: "COMPLETE" },
    sessions: [{ id: "child", title: "WAM ANALYST", role: "ANALYST" }],
    taskFileExists: true,
    loopFileExists: true,
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("uses documented defaults", () => {
    const options = parseArgs([]);
    assert.equal(options.port, 0);
    assert.equal(options.out, "");
    assert.equal(options.ephemeral, false);
    assert.equal(options.keep, false);
    assert.equal(options.autoApprove, true);
    assert.equal(options.timeout, 240000);
    assert.equal(options.serverTimeout, 30000);
    assert.equal(options.prompt, DEFAULT_PROMPT);
    assert.equal(options.model, "");
    assert.equal(options.help, false);
  });

  it("parses overrides", () => {
    const options = parseArgs([
      "--port",
      "5011",
      "--keep",
      "--no-auto-approve",
      "--timeout",
      "1000",
      "--out",
      "/tmp/x",
      "--prompt",
      "hi",
      "--model",
      "omni/cost-saver",
      "--ephemeral",
    ]);
    assert.equal(options.port, 5011);
    assert.equal(options.keep, true);
    assert.equal(options.ephemeral, true);
    assert.equal(options.autoApprove, false);
    assert.equal(options.timeout, 1000);
    assert.equal(options.out, "/tmp/x");
    assert.equal(options.prompt, "hi");
    assert.equal(options.model, "omni/cost-saver");
  });

  it("throws on unknown and valueless flags", () => {
    assert.throws(() => parseArgs(["--nope"]), /Unknown argument/);
    assert.throws(() => parseArgs(["--port"]), /Missing value/);
    assert.throws(() => parseArgs(["--prompt", "--keep"]), /Missing value/);
  });

  it("sets help", () => {
    assert.equal(parseArgs(["--help"]).help, true);
  });

  it("defaults reports to a durable in-repo evidence path", () => {
    assert.equal(
      defaultReportDir("run-1", false, "/repo"),
      path.join("/repo", "openspec", "evidence", "web-e2e", "run-1"),
    );
    assert.equal(
      defaultReportDir("run-1", true, "/repo"),
      path.join(os.tmpdir(), "wam-web-e2e", "run-1"),
    );
  });
});

describe("buildFixtureConfig", () => {
  it("writes the required task-loop config", () => {
    const config = JSON.parse(buildFixtureConfig());
    assert.equal(config.logging, true);
    assert.equal(config.enforcement, true);
    assert.equal(config.autoLoop, false);
    assert.equal(config.taskLoop.enabled, true);
    assert.equal(config.taskLoop.agents.enabled, true);
    assert.equal(config.taskLoop.agents.toolTimeoutMs, 300000);
  });
});

describe("pickTaskDir", () => {
  it("picks the newest task and respects known names", () => {
    const root = tempRoot();
    const tasks = path.join(root, ".wam", "tasks");
    mkdirSync(path.join(tasks, "old"), { recursive: true });
    mkdirSync(path.join(tasks, "new"), { recursive: true });
    writeFileSync(path.join(tasks, "old", "task.json"), "{}");
    writeFileSync(path.join(tasks, "new", "task.json"), "{}");
    utimesSync(path.join(tasks, "old", "task.json"), new Date(Date.now() - 60000), new Date(Date.now() - 60000));
    utimesSync(path.join(tasks, "new", "task.json"), new Date(), new Date());

    assert.equal(path.basename(pickTaskDir(root)), "new");
    assert.equal(path.basename(pickTaskDir(root, new Set(["new"]))), "old");
    assert.equal(pickTaskDir(tempRoot()), null);
  });
});

describe("evaluateChecks", () => {
  it("passes a complete validated scenario", () => {
    const checks = evaluateChecks(baseInput());
    assert.deepEqual(
      checks.map((check) => check.name),
      [
        "server-ready",
        "session-created",
        "contract-approved",
        "agent-pass-ran",
        "agent-pass-settled",
        "loop-complete",
        "failure-surfaced",
        "no-empty-response",
        "artifacts-present",
      ],
    );
    assert.equal(checks.every((check) => check.ok), true);
  });

  it("fails agent-pass-settled when the run is stalled", () => {
    const input = baseInput();
    input.task = {
      ...input.task,
      phase: "IMPLEMENTING",
      agentRun: { status: null, results: [] },
      executionGate: { active: false },
    };
    input.sessions = [];
    const checks = evaluateChecks(input);
    assert.equal(checkByName(checks, "agent-pass-settled").ok, false);
  });

  it("does not count the parent session as an agent pass", () => {
    const input = baseInput();
    input.task.agentRun = { status: null, results: [] };
    input.sessions = [
      { id: "parent", title: "WAM web e2e run", parentID: null, role: "WEB" },
    ];
    const checks = evaluateChecks(input);
    assert.equal(checkByName(checks, "agent-pass-ran").ok, false);

    input.sessions = [
      { id: "child", title: "WAM ANALYST task", parentID: "parent", role: "ANALYST" },
    ];
    assert.equal(checkByName(evaluateChecks(input), "agent-pass-ran").ok, true);
  });

  it("fails no-empty-response for an empty failure reason", () => {
    const input = baseInput();
    input.task.agentRun = {
      status: "FAILED",
      failureReason: "",
      surfaced: true,
      results: [{ role: "BUILDER", status: "FAILED" }],
    };
    input.task.executionGate = { active: false };
    const checks = evaluateChecks(input);
    assert.equal(checkByName(checks, "no-empty-response").ok, false);
  });

  it("accepts a surfaced provider failure", () => {
    const input = baseInput();
    input.task.phase = "FAILED";
    input.task.agentRun = {
      status: "FAILED",
      failureReason: "APIError: 401 invalid api key",
      surfaced: true,
      results: [{ role: "BUILDER", status: "FAILED" }],
    };
    input.task.executionGate = { active: false };
    const checks = evaluateChecks(input);
    assert.equal(checkByName(checks, "failure-surfaced").ok, true);
    assert.equal(checkByName(checks, "no-empty-response").ok, true);
  });
});

describe("redactSecrets", () => {
  it("redacts credentials but keeps token metrics", () => {
    const raw = [
      "authorization: Bearer abcdef123456",
      "bearer abcdef123456",
      "api-key: sk-abcdefghijklmnop",
      "api_key=supersecretvalue",
      "secret: mysecret",
      "password=hunter2",
      '{"token":"tok_abc123","tokens":{"input":1}}',
      "keys sk-abcdefghijklmnop and o1_abcdefghijklmnop",
    ].join("\n");
    const redacted = redactSecrets(raw);
    assert.equal(redacted.includes("abcdef123456"), false);
    assert.equal(redacted.includes("sk-abcdefghijklmnop"), false);
    assert.equal(redacted.includes("supersecretvalue"), false);
    assert.equal(redacted.includes("mysecret"), false);
    assert.equal(redacted.includes("hunter2"), false);
    assert.equal(redacted.includes("tok_abc123"), false);
    assert.equal(redacted.includes("o1_abcdefghijklmnop"), false);
    assert.equal(redacted.includes('"tokens":{"input":1}'), true);
  });
});

describe("summarizeSession", () => {
  it("extracts role, text and error from an assistant message", () => {
    const summary = summarizeSession(
      { id: "s1", title: "WAM ANALYST", parentID: "p1", time: { created: 1, updated: 2 } },
      [
        { info: { role: "user" }, parts: [{ type: "text", text: "hello" }] },
        {
          info: {
            role: "assistant",
            finish: "stop",
            error: { name: "APIError", data: { message: "boom" } },
          },
          parts: [{ type: "text", text: "analysis text" }],
        },
      ],
    );
    assert.equal(summary.role, "ANALYST");
    assert.equal(summary.lastTextExcerpt, "analysis text");
    assert.equal(summary.error, "boom");
    assert.equal(summary.lastAssistantFinish, "stop");
    assert.equal(summary.messageCount, 2);
    assert.equal(summary.parentID, "p1");
  });
});

describe("renderMarkdown and exitCodeFor", () => {
  const report = {
    schemaVersion: 1,
    runId: "run-abc",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    durationMs: 1000,
    exitCode: 0,
    error: null,
    options: parseArgs([]),
    environment: {
      node: "24.0.0",
      opencode: "1.0.0",
      gitHead: "deadbeef",
      gitDirty: false,
      platform: "linux x64",
    },
    fixturePath: "/tmp/fixture",
    reportDir: "/tmp/report",
    server: { pid: 10, port: 5000, baseUrl: "http://127.0.0.1:5000", logPath: "/tmp/report/server.log" },
    session: { id: "ses_1", prompt: "hi", approvalPrompt: "/wam contract approve" },
    timeline: [{ at: "2026-01-01T00:00:00.000Z", type: "server-ready" }],
    task: null,
    loop: null,
    sessions: [],
    checks: [{ name: "server-ready", ok: true, required: true, detail: "ok" }],
    artifacts: ["/tmp/report/task.json"],
    logTail: "server started",
  };

  it("renders the expected markdown sections", () => {
    const markdown = renderMarkdown(report);
    assert.match(markdown, /^# WAM web E2E/m);
    assert.match(markdown, /run-abc/);
    assert.match(markdown, /## Checks/);
    assert.match(markdown, /PASS/);
    assert.match(markdown, /\/tmp\/report\/task\.json/);
  });

  it("returns 0 when all required checks pass and 1 otherwise", () => {
    assert.equal(exitCodeFor(report.checks), 0);
    assert.equal(
      exitCodeFor([{ name: "server-ready", ok: false, required: true, detail: "no" }]),
      1,
    );
    assert.equal(
      exitCodeFor([{ name: "optional", ok: false, required: false, detail: "no" }]),
      0,
    );
  });
});

describe("collectArtifacts", () => {
  it("redacts credentials copied from task and session artifacts", () => {
    const taskDir = tempRoot();
    const reportDir = tempRoot();
    mkdirSync(path.join(taskDir, "execution"), { recursive: true });
    writeFileSync(path.join(taskDir, "task.json"), '{"apiKey":"sk-abcdefghijklmnop"}\n');
    writeFileSync(
      path.join(taskDir, "execution", "loop-state.json"),
      '{"token":"tok_abc123"}\n',
    );
    writeFileSync(
      path.join(taskDir, "execution", "loop-events.jsonl"),
      '{"authorization":"Bearer abcdef123456"}\n',
    );

    collectArtifacts(taskDir, reportDir, [
      { title: "WAM ANALYST", error: "provider failed with sk-abcdefghijklmnop" },
    ]);

    for (const file of ["task.json", "loop-state.json", "loop-events.jsonl", "sessions.json"]) {
      const text = readFileSync(path.join(reportDir, file), "utf8");
      assert.equal(text.includes("sk-abcdefghijklmnop"), false, file);
      assert.equal(text.includes("tok_abc123"), false, file);
      assert.equal(text.includes("abcdef123456"), false, file);
      assert.match(text, /\[REDACTED\]/, file);
    }
  });
});
