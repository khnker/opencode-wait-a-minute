#!/usr/bin/env node
/**
 * Unit + integration tests for the WAM behavior audit engine and report renderer.
 * Does not assert on the live corpus; real-DB smoke is shape-tolerant only.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  ALIGNED_THRESHOLD,
  WEAK_THRESHOLD,
  assessCompletion,
  assessDirection,
  assessRetry,
  correlateTask,
  directionFromScore,
  discoverTasks,
  discoverWamRoots,
  evaluateGate,
  exactSessionMatch,
  loadWamState,
  redact,
  retryFromSignals,
  runAudit,
  wordOverlapScore,
} from "./wam-audit.mjs";

import {
  renderIndexMarkdown,
  renderProjectMarkdown,
  writeReports,
} from "./wam-audit-report.mjs";

const SQLITE3 = process.env.SQLITE3 || "/usr/bin/sqlite3";
const NOW = "2026-01-01T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

function taskFixture(overrides = {}) {
  const taskDir = overrides.taskDir || "/tmp/proj/.wam/tasks/ses-TESTTEST01";
  const statePath = path.join(taskDir, "state.yaml");
  const artifacts = {
    "summary.md": false,
    "recent-changes.md": false,
    "context.md": false,
    ...(overrides.artifacts || {}),
  };
  const state = {
    phase: "EXECUTING",
    projectPath: "/tmp/proj",
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "implement delete accounts", scope: "api", approvedAt: NOW },
    nextAction: "write tests",
    lastAction: "planned",
    activeGates: [],
    questions: [],
    ...(overrides.state || {}),
  };
  return {
    taskId: "ses-TESTTEST01",
    taskDir,
    statePath,
    state,
    raw: JSON.stringify(state, null, 2),
    corrupt: false,
    reason: null,
    projectPath: state.projectPath,
    artifacts,
    mtimeMs: NOW_MS - 3600_000,
    requirements: (state.requirements || []).map((r, i) =>
      typeof r === "string"
        ? { id: `req-${i + 1}`, title: r, status: null, evidence: [] }
        : {
            id: r.id || `req-${i + 1}`,
            title: r.title || "",
            status: r.status || null,
            evidence: r.evidence || [],
          },
    ),
    ...overrides,
    state: overrides.state ? { ...state, ...overrides.state } : state,
    artifacts,
  };
}

function emptyDb() {
  return {
    available: true,
    reason: null,
    projects: [],
    sessions: [],
    firstUserTextBySession: new Map(),
    errorPartsBySession: new Map(),
    tables: ["project", "session", "message", "part"],
  };
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

test("redact replaces sk-, ghp_, gho_, github_pat_, Bearer, and key=value secrets", () => {
  assert.equal(redact("sk-abcDEF1234567890"), "[REDACTED]");
  assert.equal(redact("token ghp_abcdefghijklmnopqrstuv"), "token [REDACTED]");
  assert.equal(redact("gho_abcdefghijklmnopqrstuv"), "[REDACTED]");
  assert.equal(redact("github_pat_11AAAA0BBB"), "[REDACTED]");
  assert.match(redact("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc"), /\[REDACTED\]/);
  assert.match(redact("api_key=supersecretvalue"), /\[REDACTED\]/);
  assert.match(redact("password: hunter2"), /\[REDACTED\]/);
  assert.equal(redact("no secrets here"), "no secrets here");
});

// ---------------------------------------------------------------------------
// Direction thresholds
// ---------------------------------------------------------------------------

test("directionFromScore thresholds: ALIGNED / WEAK / DIVERGENT / NO_STRATEGY / UNKNOWN", () => {
  const base = { hasStrategy: true, hasObjective: true, corrupt: false };
  assert.equal(directionFromScore(ALIGNED_THRESHOLD, base), "ALIGNED");
  assert.equal(directionFromScore(0.9, base), "ALIGNED");
  assert.equal(directionFromScore(WEAK_THRESHOLD, base), "WEAK");
  assert.equal(directionFromScore(0.24, base), "WEAK");
  assert.equal(directionFromScore(0.049, base), "DIVERGENT");
  assert.equal(directionFromScore(0, base), "DIVERGENT");
  assert.equal(directionFromScore(1, { ...base, hasStrategy: false }), "NO_STRATEGY");
  assert.equal(directionFromScore(1, { ...base, hasObjective: false }), "UNKNOWN");
  assert.equal(directionFromScore(1, { ...base, corrupt: true }), "UNKNOWN");
});

test("wordOverlapScore is 1 for identical significant words and 0 for disjoint", () => {
  assert.ok(wordOverlapScore("implement delete accounts", "implement delete accounts") >= 0.99);
  assert.equal(wordOverlapScore("alpha beta gamma", "delta epsilon"), 0);
});

test("assessDirection emits NO_STRATEGY when approvedStrategy is missing", () => {
  const task = taskFixture({ state: { approvedStrategy: null, phase: "PROPOSED" } });
  task.state.approvedStrategy = null;
  const db = emptyDb();
  const match = { method: "exact", confidence: 1, sessionId: "ses_xxTESTTEST01" };
  db.firstUserTextBySession.set(match.sessionId, { text: "please implement delete accounts", source: "part#p1" });
  const d = assessDirection(task, db, match);
  assert.equal(d.verdict, "NO_STRATEGY");
  assert.ok(d.evidence.length >= 1);
});

test("assessDirection ALIGNED when user text overlaps strategy", () => {
  const task = taskFixture();
  const db = emptyDb();
  const match = { method: "exact", confidence: 1, sessionId: "ses_xxTESTTEST01" };
  db.firstUserTextBySession.set(match.sessionId, {
    text: "implement delete accounts for the api",
    source: "part#p1",
  });
  const d = assessDirection(task, db, match);
  assert.equal(d.verdict, "ALIGNED");
  assert.ok(d.score >= ALIGNED_THRESHOLD);
  assert.ok(d.evidence.some((e) => e.source.includes("part#") || e.source.includes("state.yaml")));
});

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

test("assessCompletion COMPLETED when DONE with summary.md", () => {
  const task = taskFixture({
    state: { phase: "DONE" },
    artifacts: { "summary.md": true, "recent-changes.md": false, "context.md": false },
  });
  task.state.phase = "DONE";
  const c = assessCompletion(task, { method: "exact", sessionId: "s1", confidence: 1 }, null, NOW);
  assert.equal(c.verdict, "COMPLETED");
  assert.ok(c.evidence.length >= 1);
});

test("assessCompletion FALSE_SUCCESS when DONE without supporting evidence", () => {
  const task = taskFixture({
    state: { phase: "DONE", requirements: [] },
    artifacts: { "summary.md": false, "recent-changes.md": false, "context.md": false },
  });
  task.state.phase = "DONE";
  task.requirements = [];
  const c = assessCompletion(task, { method: "orphan", sessionId: null, confidence: 0 }, null, NOW);
  assert.equal(c.verdict, "FALSE_SUCCESS");
});

test("assessCompletion COMPLETED when DONE and all requirements verified", () => {
  const task = taskFixture({
    state: {
      phase: "DONE",
      requirements: [{ id: "req-1", title: "x", status: "verified", evidence: ["ok"] }],
    },
    artifacts: { "summary.md": false, "recent-changes.md": false, "context.md": false },
  });
  task.state.phase = "DONE";
  task.requirements = [{ id: "req-1", title: "x", status: "verified", evidence: ["ok"] }];
  const c = assessCompletion(task, { method: "exact", sessionId: "s1", confidence: 1 }, null, NOW);
  assert.equal(c.verdict, "COMPLETED");
});

test("assessCompletion INCOMPLETE when phase is not DONE", () => {
  const task = taskFixture({ state: { phase: "EXECUTING" } });
  task.mtimeMs = NOW_MS - 86400000;
  const c = assessCompletion(
    task,
    { method: "exact", sessionId: "s1", confidence: 1 },
    { id: "s1", time_updated: NOW_MS },
    NOW,
  );
  assert.equal(c.verdict, "INCOMPLETE");
});

test("assessCompletion ABANDONED when stale > 30 days and no session activity", () => {
  const task = taskFixture({ state: { phase: "EXECUTING" } });
  task.mtimeMs = NOW_MS - 40 * 86400000;
  const c = assessCompletion(task, { method: "orphan", sessionId: null, confidence: 0 }, null, NOW);
  assert.equal(c.verdict, "ABANDONED");
});

test("assessCompletion UNKNOWN when state is corrupt", () => {
  const task = taskFixture({ corrupt: true, state: null, reason: "bad json" });
  task.corrupt = true;
  task.state = null;
  const c = assessCompletion(task, { method: "orphan", sessionId: null, confidence: 0 }, null, NOW);
  assert.equal(c.verdict, "UNKNOWN");
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

test("retryFromSignals covers all retry verdicts", () => {
  assert.equal(retryFromSignals({ failureCount: 0, completed: true, hasHypotheses: false }), "NO_RETRY_NEEDED");
  assert.equal(retryFromSignals({ failureCount: 2, completed: true, hasHypotheses: false }), "RETRIED_AND_SUCCEEDED");
  assert.equal(retryFromSignals({ failureCount: 1, completed: false, hasHypotheses: false }), "RETRIED_AND_FAILED");
  assert.equal(retryFromSignals({ failureCount: 3, completed: false, hasHypotheses: false }), "LOOPED_NO_PROGRESS");
  assert.equal(retryFromSignals({ failureCount: 0, completed: false, hasHypotheses: false }), "UNKNOWN");
});

test("assessRetry NO_RETRY_NEEDED for COMPLETED with no failure signals", () => {
  const task = taskFixture({ state: { phase: "DONE", activeGates: [], questions: [] } });
  task.state.activeGates = [];
  task.state.questions = [];
  const db = emptyDb();
  const r = assessRetry(task, db, { method: "exact", sessionId: "s1", confidence: 1 }, { verdict: "COMPLETED" });
  assert.equal(r.verdict, "NO_RETRY_NEEDED");
  assert.ok(r.evidence.length >= 1);
});

test("assessRetry LOOPED_NO_PROGRESS when >=3 error parts and not completed", () => {
  const task = taskFixture({ state: { phase: "EXECUTING", activeGates: [], questions: [] } });
  task.state.activeGates = [];
  task.state.questions = [];
  const db = emptyDb();
  db.errorPartsBySession.set("s1", [{ partId: "p1" }, { partId: "p2" }, { partId: "p3" }]);
  const r = assessRetry(task, db, { method: "exact", sessionId: "s1", confidence: 1 }, { verdict: "INCOMPLETE" });
  assert.equal(r.verdict, "LOOPED_NO_PROGRESS");
});

test("assessRetry RETRIED_AND_SUCCEEDED when errors then COMPLETED", () => {
  const task = taskFixture({ state: { phase: "DONE", activeGates: [], questions: [] } });
  task.state.activeGates = [];
  const db = emptyDb();
  db.errorPartsBySession.set("s1", [{ partId: "p1" }]);
  const r = assessRetry(task, db, { method: "exact", sessionId: "s1", confidence: 1 }, { verdict: "COMPLETED" });
  assert.equal(r.verdict, "RETRIED_AND_SUCCEEDED");
});

test("assessRetry RETRIED_AND_FAILED when gates present and not completed", () => {
  const task = taskFixture({ state: { phase: "EXECUTING", activeGates: ["scope-creep"], questions: [] } });
  task.state.activeGates = ["scope-creep"];
  const db = emptyDb();
  const r = assessRetry(task, db, { method: "orphan", sessionId: null, confidence: 0 }, { verdict: "INCOMPLETE" });
  assert.equal(r.verdict, "RETRIED_AND_FAILED");
});

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

test("exactSessionMatch matches session id suffix after ses-", () => {
  const sessions = [
    { id: "ses_f50460bc1ffe4ffETESTTEST01", title: "hello" },
    { id: "ses_other", title: "nope" },
  ];
  const m = exactSessionMatch("ses-TESTTEST01", sessions);
  assert.ok(m);
  assert.equal(m.method, "exact");
  assert.equal(m.confidence, 1.0);
  assert.equal(m.sessionId, "ses_f50460bc1ffe4ffETESTTEST01");
});

test("correlateTask reports orphan when no session matches", () => {
  const task = taskFixture({ taskId: "ses-NOSUCHXXXX" });
  task.taskId = "ses-NOSUCHXXXX";
  const db = emptyDb();
  const m = correlateTask(task, db);
  assert.equal(m.method, "orphan");
  assert.equal(m.sessionId, null);
  assert.ok(m.reason);
});

test("correlateTask prefers exact over project-time", () => {
  const task = taskFixture();
  const db = emptyDb();
  db.sessions = [
    { id: "ses_aaaaaaaaaaTESTTEST01", directory: task.projectPath, title: "x", time_updated: NOW_MS },
    { id: "ses_unrelated", directory: task.projectPath, title: "other", time_updated: NOW_MS },
  ];
  db.projects = [{ id: "p1", worktree: task.projectPath, name: "proj" }];
  const m = correlateTask(task, db);
  assert.equal(m.method, "exact");
  assert.equal(m.sessionId, "ses_aaaaaaaaaaTESTTEST01");
});

// ---------------------------------------------------------------------------
// Report determinism + sections
// ---------------------------------------------------------------------------

function sampleAudit() {
  return {
    schemaVersion: "1.0.0",
    root: "/tmp/root",
    projectFilter: "proj",
    totals: {
      projects: 1,
      tasks: 2,
      matched: 1,
      orphans: 1,
      direction: { ALIGNED: 1, UNKNOWN: 1, WEAK: 0, DIVERGENT: 0, NO_STRATEGY: 0 },
      completion: { COMPLETED: 0, FALSE_SUCCESS: 1, INCOMPLETE: 1, ABANDONED: 0, UNKNOWN: 0 },
      retry: { NO_RETRY_NEEDED: 0, RETRIED_AND_SUCCEEDED: 0, RETRIED_AND_FAILED: 1, LOOPED_NO_PROGRESS: 0, UNKNOWN: 1 },
    },
    projects: [
      {
        project: "/tmp/root/proj",
        wamPath: "/tmp/root/proj/.wam",
        coverage: { tasks: 2, matched: 1, orphanTasks: 1, orphanSessions: 0, corrupt: 0 },
        tasks: [
          {
            taskId: "ses-TESTTEST01",
            sessionId: "ses_xxTESTTEST01",
            match: { method: "exact", confidence: 1 },
            direction: {
              verdict: "ALIGNED",
              score: 0.5,
              evidence: [{ source: "part#p1", quote: "implement delete accounts api_key=supersecret" }],
            },
            completion: {
              verdict: "FALSE_SUCCESS",
              evidence: [{ source: "/tmp/root/proj/.wam/tasks/ses-TESTTEST01/state.yaml:1", quote: "phase=DONE" }],
            },
            retry: {
              verdict: "RETRIED_AND_FAILED",
              evidence: [{ source: "part#p2", quote: "1 error-like tool parts" }],
            },
            errors: [],
          },
          {
            taskId: "ses-ORPHAN0001",
            sessionId: null,
            match: { method: "orphan", confidence: 0, reason: "no_session_match" },
            direction: { verdict: "UNKNOWN", score: 0, evidence: [] },
            completion: {
              verdict: "INCOMPLETE",
              evidence: [{ source: "state.yaml:1", quote: "phase=EXECUTING" }],
            },
            retry: { verdict: "UNKNOWN", evidence: [] },
            errors: [],
          },
        ],
        orphanTasks: [{ taskId: "ses-ORPHAN0001", reason: "no_session_match", path: "/tmp/x" }],
        orphanSessions: [],
      },
    ],
  };
}

test("renderProjectMarkdown is deterministic for identical JSON + now", () => {
  const audit = sampleAudit();
  const a = renderProjectMarkdown(audit.projects[0], audit, NOW, { dataPath: "/tmp/a.json" });
  const b = renderProjectMarkdown(audit.projects[0], audit, NOW, { dataPath: "/tmp/a.json" });
  assert.equal(a, b);
});

test("renderProjectMarkdown contains mandatory headings and table columns", () => {
  const audit = sampleAudit();
  const md = renderProjectMarkdown(audit.projects[0], audit, NOW, { dataPath: "/tmp/a.json" });
  for (const h of [
    "# WAM Behavior Report: /tmp/root/proj",
    "## Coverage",
    "## Verdict Summary",
    "## Tasks",
    "## Evidence",
    "## Methodology",
    "## Reproduction",
  ]) {
    assert.ok(md.includes(h), `missing heading: ${h}`);
  }
  assert.ok(md.includes("| Task | Session | Direction | Completion | Retry | Confidence |"));
  assert.ok(md.includes("FALSE_SUCCESS"));
  assert.ok(md.includes("ses-ORPHAN0001"));
  assert.ok(md.includes("UNKNOWN — no evidence"));
  assert.ok(!md.includes("supersecret"));
  assert.ok(md.includes("[REDACTED]"));
});

test("renderIndexMarkdown aggregates projects and is deterministic", () => {
  const audit = sampleAudit();
  const a = renderIndexMarkdown(audit, NOW, { dataPath: "/tmp/a.json", indexPath: "/tmp/index.md" });
  const b = renderIndexMarkdown(audit, NOW, { dataPath: "/tmp/a.json", indexPath: "/tmp/index.md" });
  assert.equal(a, b);
  assert.ok(a.startsWith("# WAM Audit Index"));
  assert.ok(a.includes("| Project | Tasks | Matched | Orphan tasks | Orphan sessions | Ambiguous | ALIGNED | COMPLETED | FALSE_SUCCESS | RETRIED_AND_SUCCEEDED | Report |"));
  assert.ok(a.includes("node scripts/wam-audit.mjs"));
});

// ---------------------------------------------------------------------------
// Discovery + corrupt state
// ---------------------------------------------------------------------------

test("discoverWamRoots finds nested .wam and skips node_modules", () => {
  const root = tmpDir("wam-disc-");
  fs.mkdirSync(path.join(root, "keep", ".wam", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "pkg", ".wam"), { recursive: true });
  const found = discoverWamRoots(root);
  assert.equal(found.length, 1);
  assert.ok(found[0].endsWith(path.join("keep", ".wam")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("loadWamState records corrupt JSON without throwing", () => {
  const dir = tmpDir("wam-state-");
  const file = path.join(dir, "state.yaml");
  fs.writeFileSync(file, "{ not json");
  const loaded = loadWamState(file);
  assert.equal(loaded.corrupt, true);
  assert.ok(loaded.reason);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Integration: temp .wam + temp sqlite, exact correlation
// ---------------------------------------------------------------------------

function createFakeDb(dbPath, { projectPath, sessionId, userText }) {
  const sql = `
    CREATE TABLE project (id TEXT, worktree TEXT, name TEXT);
    CREATE TABLE session (
      id TEXT, project_id TEXT, directory TEXT, path TEXT,
      agent TEXT, model TEXT, title TEXT,
      time_created INTEGER, time_updated INTEGER,
      tokens_input INTEGER, tokens_output INTEGER
    );
    CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
    CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
    INSERT INTO project VALUES ('proj1', '${projectPath}', 'fixture');
    INSERT INTO session VALUES (
      '${sessionId}', 'proj1', '${projectPath}', '${projectPath}',
      'build', 'test', 'implement delete accounts',
      ${NOW_MS}, ${NOW_MS}, 1, 1
    );
    INSERT INTO message VALUES ('m1', '${sessionId}', ${NOW_MS}, '{"role":"user"}');
    INSERT INTO part VALUES ('p1', 'm1', '${sessionId}', ${NOW_MS}, json('${JSON.stringify({ type: "text", text: userText })}'));
  `;
  execFileSync(SQLITE3, [dbPath], { input: sql, encoding: "utf8" });
}

test("integration: exact correlation against a temp sqlite db", () => {
  const root = tmpDir("wam-int-");
  const projectPath = path.join(root, "fixture-proj");
  const taskDir = path.join(projectPath, ".wam", "tasks", "ses-TESTTEST01");
  fs.mkdirSync(taskDir, { recursive: true });
  writeJson(path.join(taskDir, "state.yaml"), {
    phase: "DONE",
    projectPath,
    contract: { status: "DONE", requirements: [] },
    requirements: [
      { id: "req-1", title: "implement delete accounts", status: "verified", evidence: ["summary"] },
    ],
    approvedStrategy: {
      strategy: "implement delete accounts",
      scope: "api",
      approvedAt: NOW,
    },
    nextAction: "",
    lastAction: "done",
    activeGates: [],
    questions: [],
  });
  fs.writeFileSync(path.join(taskDir, "summary.md"), "# done\n");

  const dbPath = path.join(root, "opencode.db");
  const sessionId = "ses_f50460bc1ffe4ffETESTTEST01";
  createFakeDb(dbPath, {
    projectPath,
    sessionId,
    userText: "please implement delete accounts on the api",
  });

  const out = path.join(root, "out");
  const result = runAudit({
    root,
    out,
    now: NOW,
    dbPath,
    dryRun: false,
  });

  assert.equal(result.totals.projects, 1);
  assert.equal(result.totals.tasks, 1);
  const task = result.projects[0].tasks[0];
  assert.equal(task.taskId, "ses-TESTTEST01");
  assert.equal(task.match.method, "exact");
  assert.equal(task.match.confidence, 1);
  assert.equal(task.sessionId, sessionId);
  assert.equal(task.completion.verdict, "COMPLETED");
  assert.equal(task.direction.verdict, "ALIGNED");
  assert.ok(fs.existsSync(path.join(out, "wam-audit.json")));

  const corruptDir = path.join(projectPath, ".wam", "tasks", "ses-CORRUPT001");
  fs.mkdirSync(corruptDir, { recursive: true });
  fs.writeFileSync(path.join(corruptDir, "state.yaml"), ":::not-json:::");
  const result2 = runAudit({ root, out: path.join(root, "out2"), now: NOW, dbPath });
  assert.ok(result2.projects[0].coverage.corrupt >= 1);
  const corruptTask = result2.projects[0].tasks.find((t) => t.taskId === "ses-CORRUPT001");
  assert.ok(corruptTask);
  assert.equal(corruptTask.direction.verdict, "UNKNOWN");

  fs.rmSync(root, { recursive: true, force: true });
});

test("dry-run writes nothing", () => {
  const root = tmpDir("wam-dry-");
  const projectPath = path.join(root, "p");
  fs.mkdirSync(path.join(projectPath, ".wam", "tasks", "ses-TESTTEST01"), { recursive: true });
  writeJson(path.join(projectPath, ".wam", "tasks", "ses-TESTTEST01", "state.yaml"), {
    phase: "PROPOSED",
    projectPath,
    contract: { status: "PROPOSED" },
    requirements: [],
    activeGates: [],
    questions: [],
  });
  const out = path.join(root, "out");
  runAudit({ root, out, now: NOW, dbPath: path.join(root, "missing.db"), dryRun: true });
  assert.equal(fs.existsSync(out), false);
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Shape-tolerant smoke against the real DB (no corpus assertions)
// ---------------------------------------------------------------------------

test("smoke: real corpus run produces the documented JSON shape", () => {
  const out = tmpDir("wam-smoke-");
  const result = runAudit({
    root: "/home/nicolas/dev",
    project: "comparador-precios",
    out,
    now: NOW,
  });
  assert.equal(typeof result.schemaVersion, "string");
  assert.ok(result.totals && typeof result.totals.tasks === "number");
  assert.ok(Array.isArray(result.projects));
  for (const p of result.projects) {
    assert.equal(typeof p.project, "string");
    assert.ok(p.coverage);
    assert.ok(Array.isArray(p.tasks));
    for (const t of p.tasks) {
      assert.equal(typeof t.taskId, "string");
      assert.ok(t.match && typeof t.match.method === "string");
      assert.ok(t.direction && typeof t.direction.verdict === "string");
      assert.ok(Array.isArray(t.direction.evidence));
      assert.ok(t.completion && typeof t.completion.verdict === "string");
      assert.ok(t.retry && typeof t.retry.verdict === "string");
    }
  }
  const jsonPath = path.join(out, "wam-audit.json");
  assert.ok(fs.existsSync(jsonPath));
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  assert.equal(parsed.schemaVersion, result.schemaVersion);
  fs.rmSync(out, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// FIX 5 — ABANDONED with newest-artifact mtime
// ---------------------------------------------------------------------------

test("assessCompletion ABANDONED when newest artifact mtime > 30d before --now", () => {
  const task = taskFixture({ state: { phase: "EXECUTING" } });
  // taskDir itself touched now, but state.yaml is 60d before --now.
  task.mtimeMs = NOW_MS - 60 * 86400000;
  const session = null; // no later session activity
  const c = assessCompletion(
    task,
    { method: "orphan", sessionId: null, confidence: 0 },
    session,
    NOW,
  );
  assert.equal(c.verdict, "ABANDONED");
});

test("assessCompletion not ABANDONED when an artifact was touched within 30d of --now", () => {
  const task = taskFixture({ state: { phase: "EXECUTING" } });
  // taskDir is old but state.yaml (newest artifact) is fresh.
  task.mtimeMs = NOW_MS - 5 * 86400000;
  const c = assessCompletion(
    task,
    { method: "orphan", sessionId: null, confidence: 0 },
    null,
    NOW,
  );
  assert.notEqual(c.verdict, "ABANDONED");
});

// ---------------------------------------------------------------------------
// FIX 2 — ambiguity across projects
// ---------------------------------------------------------------------------

test("correlateTask groups by sessionId and marks ambiguous on cross-project collisions", () => {
  // Two tasks, same suffix, two distinct projects. Both should resolve via
  // exactSessionMatch but the cross-project pass must demote to ambiguous.
  const root = tmpDir("wam-amb-");
  const projA = path.join(root, "projA");
  const projB = path.join(root, "projB");
  const taskDirA = path.join(projA, ".wam", "tasks", "ses-AMBIGUOUS");
  const taskDirB = path.join(projB, ".wam", "tasks", "ses-AMBIGUOS"); // different suffix
  fs.mkdirSync(taskDirA, { recursive: true });
  fs.mkdirSync(taskDirB, { recursive: true });
  writeJson(path.join(taskDirA, "state.yaml"), {
    phase: "EXECUTING",
    projectPath: projA,
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "ship foo", scope: "api", approvedAt: NOW },
    nextAction: "",
    lastAction: "",
    activeGates: [],
    questions: [],
  });
  writeJson(path.join(taskDirB, "state.yaml"), {
    phase: "EXECUTING",
    projectPath: projB,
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "ship bar", scope: "api", approvedAt: NOW },
    nextAction: "",
    lastAction: "",
    activeGates: [],
    questions: [],
  });

  // Build DB with ONE sessionId that ends with both suffixes — impossible with
  // real suffix matching. Instead, force both tasks to collide on a single
  // sessionId by giving them the SAME suffix.
  const sharedSuffix = "COLLIDE0001";
  fs.mkdirSync(path.join(projB, ".wam", "tasks", `ses-${sharedSuffix}`), { recursive: true });
  writeJson(path.join(projB, ".wam", `tasks/ses-${sharedSuffix}/state.yaml`), {
    phase: "EXECUTING",
    projectPath: projB,
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "ship bar", scope: "api", approvedAt: NOW },
    nextAction: "",
    lastAction: "",
    activeGates: [],
    questions: [],
  });
  fs.mkdirSync(path.join(projA, ".wam", "tasks", `ses-${sharedSuffix}`), { recursive: true });
  writeJson(path.join(projA, ".wam", `tasks/ses-${sharedSuffix}/state.yaml`), {
    phase: "EXECUTING",
    projectPath: projA,
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "ship foo", scope: "api", approvedAt: NOW },
    nextAction: "",
    lastAction: "",
    activeGates: [],
    questions: [],
  });
  // Remove the prior distinct-suffix tasks so only the colliding pair remains.
  fs.rmSync(taskDirA, { recursive: true, force: true });
  fs.rmSync(taskDirB, { recursive: true, force: true });

  const dbPath = path.join(root, "opencode.db");
  const sharedSessionId = `ses_x${sharedSuffix}`;
  // Both projects reference the same sessionId → both tasks match it exactly.
  const sql = `
    CREATE TABLE project (id TEXT, worktree TEXT, name TEXT);
    CREATE TABLE session (id TEXT, project_id TEXT, directory TEXT, path TEXT,
      agent TEXT, model TEXT, title TEXT,
      time_created INTEGER, time_updated INTEGER,
      tokens_input INTEGER, tokens_output INTEGER);
    CREATE TABLE message (id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
    CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, time_created INTEGER, data TEXT);
    INSERT INTO project VALUES ('pA', '${projA}', 'A');
    INSERT INTO project VALUES ('pB', '${projB}', 'B');
    INSERT INTO session VALUES ('${sharedSessionId}', 'pA', '${projA}', '${projA}',
      'build','test','ship', ${NOW_MS}, ${NOW_MS}, 1, 1);
  `;
  execFileSync(SQLITE3, [dbPath], { input: sql, encoding: "utf8" });

  const out = path.join(root, "out");
  const result = runAudit({ root, out, now: NOW, dbPath });
  assert.ok(result.totals.ambiguousMatches >= 1, "ambiguousMatches should be >=1");
  let foundAmbiguous = false;
  for (const pr of result.projects) {
    if (pr.coverage.ambiguousMatches > 0) {
      foundAmbiguous = true;
      for (const t of pr.tasks) {
        if (t.match && t.match.ambiguous) {
          assert.ok(["exact-ambiguous", "project-time-ambiguous"].includes(t.match.method));
          assert.equal(typeof t.match.confidence, "number");
        }
      }
    }
  }
  assert.ok(foundAmbiguous, "at least one project should report ambiguousMatches > 0");
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// FIX 3 — don't dirty repos: writeReports falls back when path is not gitignored
// ---------------------------------------------------------------------------

test("writeReports writes to WAM_AUDIT_HOME/reports when .wam is not gitignored", () => {
  const root = tmpDir("wam-fbk-");
  const projectPath = path.join(root, "proj");
  fs.mkdirSync(path.join(projectPath, ".wam", "tasks", "ses-ABCDEF01"), { recursive: true });
  fs.mkdirSync(path.join(projectPath, ".git"), { recursive: true });
  // Add .gitignore that does NOT include .wam
  fs.writeFileSync(path.join(projectPath, ".gitignore"), "node_modules\n");
  // Also stage a dummy file so git treats the repo as initialized enough.
  try {
    execFileSync("git", ["-C", projectPath, "init", "-q"], { stdio: "ignore" });
    execFileSync("git", ["-C", projectPath, "config", "user.email", "t@t"], { stdio: "ignore" });
    execFileSync("git", ["-C", projectPath, "config", "user.name", "t"], { stdio: "ignore" });
    fs.writeFileSync(path.join(projectPath, "README"), "x");
    execFileSync("git", ["-C", projectPath, "add", "README"], { stdio: "ignore" });
  } catch {
    // git not available — skip
    fs.rmSync(root, { recursive: true, force: true });
    return;
  }
  writeJson(path.join(projectPath, ".wam", "tasks", "ses-ABCDEF01", "state.yaml"), {
    phase: "EXECUTING",
    projectPath,
    contract: { status: "APPROVED", requirements: [] },
    requirements: [],
    approvedStrategy: { strategy: "ship it", scope: "all", approvedAt: NOW },
    nextAction: "",
    lastAction: "",
    activeGates: [],
    questions: [],
  });

  const homeRoot = tmpDir("wam-home-");
  process.env.WAM_AUDIT_HOME = homeRoot;
  try {
    const audit = {
      schemaVersion: "1.0.0",
      root,
      projectFilter: null,
      totals: { projects: 1, tasks: 1, matched: 0, orphans: 1, orphanTasks: 1, orphanSessions: 0, ambiguousMatches: 0, distinctSessions: 0,
        direction: { ALIGNED: 0, WEAK: 0, DIVERGENT: 0, NO_STRATEGY: 0, UNKNOWN: 1 },
        completion: { COMPLETED: 0, FALSE_SUCCESS: 0, INCOMPLETE: 1, ABANDONED: 0, UNKNOWN: 0 },
        retry: { NO_RETRY_NEEDED: 0, RETRIED_AND_SUCCEEDED: 0, RETRIED_AND_FAILED: 0, LOOPED_NO_PROGRESS: 0, UNKNOWN: 1 } },
      projects: [
        {
          project: projectPath,
          wamPath: path.join(projectPath, ".wam"),
          coverage: { tasks: 1, matched: 0, orphanTasks: 1, orphanSessions: 0, ambiguousMatches: 0, corrupt: 0 },
          tasks: [],
          orphanTasks: [],
          orphanSessions: [],
        },
      ],
    };
    const idx = path.join(homeRoot, "index.md");
    const written = writeReports(audit, { index: idx });
    // Find the fallback report path
    const fallback = path.join(homeRoot, "reports");
    assert.ok(fs.existsSync(fallback), `fallback dir missing: ${fallback}`);
    // Ensure projectPath/.wam/audit/ was NOT created (would dirty the repo)
    const inPlace = path.join(projectPath, ".wam", "audit", "wam-behavior-report.md");
    assert.ok(!fs.existsSync(inPlace), `in-place report was written: ${inPlace}`);
    assert.ok(written.some((w) => w.startsWith(fallback)));
    // project coverage should be annotated
    assert.equal(audit.projects[0].coverage.reportFallback, true);
  } finally {
    delete process.env.WAM_AUDIT_HOME;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(homeRoot, { recursive: true, force: true });
  }
});
test("discoverTasks marks history tasks archived and keeps active tasks live", () => {
  const root = tmpDir("wam-disc-");
  try {
    const wam = path.join(root, ".wam");
    const activeDir = path.join(wam, "tasks", "ses-ACTIVE0001");
    const histDir = path.join(wam, "history", "2026-01-01", "ses-HISTORY001");
    fs.mkdirSync(activeDir, { recursive: true });
    fs.mkdirSync(histDir, { recursive: true });
    const state = {
      phase: "EXECUTING",
      projectPath: root,
      contract: { status: "APPROVED", requirements: [] },
      requirements: [],
      approvedStrategy: { strategy: "ship it", scope: "all", approvedAt: NOW },
      nextAction: "",
      lastAction: "",
      activeGates: [],
      questions: [],
    };
    writeJson(path.join(activeDir, "state.yaml"), state);
    writeJson(path.join(histDir, "state.yaml"), state);

    const { tasks } = discoverTasks(wam);
    assert.equal(tasks.length, 2);
    const ids = tasks.map((t) => t.taskId).sort();
    assert.deepEqual(ids, ["ses-ACTIVE0001", "ses-HISTORY001"]);
    assert.equal(new Set(ids).size, 2, "no duplicate task ids");
    const active = tasks.find((t) => t.taskId === "ses-ACTIVE0001");
    const archived = tasks.find((t) => t.taskId === "ses-HISTORY001");
    assert.equal(active.archived, false);
    assert.equal(archived.archived, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("evaluateGate passes with empty loops/ambiguous under defaults", () => {
  const result = evaluateGate({
    tasks: 10,
    direction: { NO_STRATEGY: 0 },
    retry: { LOOPED_NO_PROGRESS: 0 },
    ambiguousMatches: 0,
  });
  assert.equal(result.passed, true);
  assert.equal(result.violations.length, 0);
});

test("evaluateGate fails on LOOPED_NO_PROGRESS above maxLoopedNoProgress", () => {
  const result = evaluateGate(
    {
      tasks: 10,
      direction: { NO_STRATEGY: 9 },
      retry: { LOOPED_NO_PROGRESS: 3 },
      ambiguousMatches: 99,
    },
    { maxLoopedNoProgress: 0 },
  );
  assert.equal(result.passed, false);
  const looped = result.violations.find((v) => v.metric === "LOOPED_NO_PROGRESS");
  assert.ok(looped, "expected LOOPED_NO_PROGRESS violation");
  assert.equal(looped.actual, 3);
  assert.equal(looped.limit, 0);
});

