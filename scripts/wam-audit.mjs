#!/usr/bin/env node
/**
 * WAM Behavior Audit — read-only cross-source engine + CLI.
 *
 * node scripts/wam-audit.mjs [--root DIR] [--out DIR] [--project NAME] [--now ISO] [--dry-run]
 *
 * Never writes to the OpenCode DB or any .wam state. Exit 0 on corrupt
 * records and missing DB (degrades to UNKNOWN / orphans).
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SCHEMA_VERSION = "1.0.0";
export const DEFAULT_ROOT = "/home/nicolas/dev";
export const DEFAULT_DB_PATH = "/home/nicolas/.local/share/opencode/opencode.db";
export const SQLITE3 = process.env.SQLITE3 || "/usr/bin/sqlite3";
export const MAX_DISCOVERY_DEPTH = 10;
export const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".cache",
]);
export const ARTIFACT_NAMES = ["summary.md", "recent-changes.md", "context.md"];
export const DIRECTION_VERDICTS = ["ALIGNED", "WEAK", "DIVERGENT", "NO_STRATEGY", "UNKNOWN"];
export const COMPLETION_VERDICTS = ["COMPLETED", "FALSE_SUCCESS", "INCOMPLETE", "ABANDONED", "UNKNOWN"];
export const RETRY_VERDICTS = [
  "NO_RETRY_NEEDED",
  "RETRIED_AND_SUCCEEDED",
  "RETRIED_AND_FAILED",
  "LOOPED_NO_PROGRESS",
  "UNKNOWN",
];
export const ALIGNED_THRESHOLD = 0.25;
export const WEAK_THRESHOLD = 0.05;
export const STALE_DAYS = 30;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "at", "by", "is", "are", "was", "were", "be", "been", "this", "that", "these",
  "those", "it", "its", "as", "from", "into", "sobre", "para", "con", "los",
  "las", "del", "de", "la", "el", "y", "o", "que", "se", "en", "un", "una",
  "es", "son", "fue", "ser", "como", "mas", "más", "al", "le", "lo", "su",
  "sus", "por", "si", "no", "ya", "you", "we", "they", "he", "she", "not",
  "can", "will", "just", "all", "your", "our", "please", "use", "using",
]);

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /ghp_[A-Za-z0-9]+/g,
  /gho_[A-Za-z0-9]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi,
];

export function redact(str) {
  if (typeof str !== "string") return str;
  let out = str;
  out = out.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
  out = out.replace(/ghp_[A-Za-z0-9]+/g, "[REDACTED]");
  out = out.replace(/gho_[A-Za-z0-9]+/g, "[REDACTED]");
  out = out.replace(/github_pat_[A-Za-z0-9_]+/g, "[REDACTED]");
  out = out.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  out = out.replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*\S+/gi, (m) =>
    m.replace(/\S+$/, "[REDACTED]"),
  );
  return out;
}

export function redactDeep(value) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}

function shortQuote(text, n = 120) {
  const s = redact(String(text ?? "").replace(/\s+/g, " ").trim());
  return s.length <= n ? s : s.slice(0, n);
}

function evidenceOf(source, quote) {
  return { source: redact(String(source)), quote: shortQuote(quote) };
}

function sortEvidence(list) {
  return [...list].sort((a, b) => String(a.source).localeCompare(String(b.source)));
}

function lineOf(raw, key) {
  if (!raw || !key) return 1;
  const lines = String(raw).split("\n");
  const needle = `"${key}"`;
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx >= 0 ? idx + 1 : 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = {
    root: DEFAULT_ROOT,
    out: null,
    project: null,
    now: null,
    dryRun: false,
    dbPath: DEFAULT_DB_PATH,
    gate: false,
    config: null,
    baseline: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") args.root = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--project") args.project = argv[++i];
    else if (a === "--now") args.now = argv[++i];
    else if (a === "--db") args.dbPath = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--gate") args.gate = true;
    else if (a === "--config") args.config = argv[++i];
    else if (a === "--baseline") args.baseline = argv[++i];
  }
  return args;
}

export function isMain(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return metaUrl === pathToFileURL(path.resolve(argv1)).href;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function discoverWamRoots(root, depth = 0, seen = new Set()) {
  const found = [];
  if (depth > MAX_DISCOVERY_DEPTH) return found;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const ent of entries) {
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const full = path.join(root, ent.name);
    let real;
    try {
      real = fs.realpathSync(full);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    if (ent.name === ".wam") {
      found.push(full);
      continue;
    }
    found.push(...discoverWamRoots(full, depth + 1, seen));
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function projectMatchesFilter(projectPath, filter) {
  if (!filter) return true;
  return path.basename(projectPath) === filter || projectPath === filter || projectPath.endsWith(`/${filter}`);
}

// ---------------------------------------------------------------------------
// WAM ingestion
// ---------------------------------------------------------------------------

export function loadWamState(statePath) {
  let raw;
  try {
    raw = fs.readFileSync(statePath, "utf8");
  } catch (err) {
    return { ok: false, corrupt: true, reason: String(err.message || err), state: null, raw: null };
  }
  try {
    const state = JSON.parse(raw);
    if (state === null || typeof state !== "object" || Array.isArray(state)) {
      return { ok: false, corrupt: true, reason: "state is not an object", state: null, raw };
    }
    return { ok: true, corrupt: false, reason: null, state, raw };
  } catch (err) {
    return { ok: false, corrupt: true, reason: String(err.message || err), state: null, raw };
  }
}

export function taskArtifacts(taskDir) {
  const present = {};
  for (const name of ARTIFACT_NAMES) {
    present[name] = fs.existsSync(path.join(taskDir, name));
  }
  return present;
}

export function normalizeRequirements(state) {
  const raw = (state && (state.requirements || (state.contract && state.contract.requirements))) || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    if (typeof r === "string") {
      return { id: `req-${i + 1}`, title: r, status: null, evidence: [] };
    }
    const ev = r && Array.isArray(r.evidence) ? r.evidence : [];
    return {
      id: (r && r.id) || `req-${i + 1}`,
      title: (r && r.title) || "",
      status: (r && r.status) || null,
      evidence: ev,
    };
  });
}

function requirementVerified(r) {
  const s = String(r.status || "").toUpperCase();
  if (s === "VERIFIED" || s === "DONE" || s === "COMPLETED" || s === "COMPLETE") return true;
  if (Array.isArray(r.evidence) && r.evidence.length > 0) return true;
  return false;
}

export function discoverTasks(wamRoot) {
  const tasks = [];
  const corrupt = [];
  const tasksDir = path.join(wamRoot, "tasks");
  const historyDir = path.join(wamRoot, "history");

  const scanDir = (baseDir, isArchived) => {
    if (!fs.existsSync(baseDir)) return;
    let entries = [];
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (isArchived && /^\d{4}-\d{2}-\d{2}$/.test(ent.name)) {
        scanDir(path.join(baseDir, ent.name), true);
        continue;
      }
      const taskDir = path.join(baseDir, ent.name);
      const statePath = path.join(taskDir, "state.yaml");
      if (!fs.existsSync(statePath)) continue;
      let mtimeMs = 0;
      try {
        const candidates = [statePath];
        for (const name of ARTIFACT_NAMES) {
          candidates.push(path.join(taskDir, name));
        }
        for (const p of candidates) {
          try {
            const st = fs.statSync(p);
            if (st.mtimeMs > mtimeMs) mtimeMs = st.mtimeMs;
          } catch {
            // ignore missing
          }
        }
      } catch {
        mtimeMs = 0;
      }
      const loaded = loadWamState(statePath);
      if (loaded.corrupt) {
        corrupt.push({ taskId: ent.name, reason: loaded.reason, path: statePath });
        tasks.push({
          taskId: ent.name,
          taskDir,
          statePath,
          state: null,
          raw: loaded.raw,
          corrupt: true,
          reason: loaded.reason,
          projectPath: path.dirname(wamRoot),
          artifacts: taskArtifacts(taskDir),
          mtimeMs,
          requirements: [],
          archived: isArchived,
        });
        continue;
      }
      const state = loaded.state;
      tasks.push({
        taskId: ent.name,
        taskDir,
        statePath,
        state,
        raw: loaded.raw,
        corrupt: false,
        reason: null,
        projectPath: state.projectPath || path.dirname(wamRoot),
        artifacts: taskArtifacts(taskDir),
        mtimeMs,
        requirements: normalizeRequirements(state),
        archived: isArchived,
      });
    }
  };

  scanDir(tasksDir, false);
  scanDir(historyDir, true);
  tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));
  return { tasks, corrupt };
}

// ---------------------------------------------------------------------------
// OpenCode DB (read-only)
// ---------------------------------------------------------------------------

function sqliteJson(fileArg, sql) {
  const stdout = execFileSync(SQLITE3, ["-json", fileArg, sql], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    timeout: 60000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const trimmed = String(stdout || "").trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return Array.isArray(parsed) ? parsed : [];
}

export function queryDb(dbPath, sql) {
  const uriImmutable = `file:${dbPath}?mode=ro&immutable=1`;
  try {
    return sqliteJson(uriImmutable, sql);
  } catch (first) {
    const uriRo = `file:${dbPath}?mode=ro`;
    try {
      return sqliteJson(uriRo, sql);
    } catch {
      throw first;
    }
  }
}

function emptyDb(reason) {
  return {
    available: false,
    reason,
    projects: [],
    sessions: [],
    firstUserTextBySession: new Map(),
    errorPartsBySession: new Map(),
    tables: [],
  };
}

export function loadOpencodeDb(dbPath = DEFAULT_DB_PATH) {
  if (!dbPath || !fs.existsSync(dbPath)) return emptyDb("db_missing");
  try {
    const tables = queryDb(dbPath, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
    const tableNames = new Set(tables.map((t) => t.name));
    if (!tableNames.has("session") || !tableNames.has("project")) {
      return emptyDb("schema_missing_required_tables");
    }
    const projects = queryDb(dbPath, "SELECT id, worktree, name FROM project;");
    const sessions = queryDb(
      dbPath,
      "SELECT id, project_id, directory, path, agent, model, title, time_created, time_updated, tokens_input, tokens_output FROM session;",
    );
    const firstUserTextBySession = new Map();
    const errorPartsBySession = new Map();
    if (tableNames.has("part") && tableNames.has("message")) {
      try {
        const userParts = queryDb(
          dbPath,
          `SELECT p.session_id AS session_id, p.id AS part_id, p.time_created AS time_created,
                  json_extract(p.data, '$.text') AS text
             FROM part p
             JOIN message m ON m.id = p.message_id
            WHERE json_extract(m.data, '$.role') = 'user'
              AND json_extract(p.data, '$.type') = 'text'
              AND json_extract(p.data, '$.text') IS NOT NULL
            ORDER BY p.time_created ASC, p.id ASC;`,
        );
        for (const row of userParts) {
          if (!row.session_id) continue;
          if (firstUserTextBySession.has(row.session_id)) continue;
          const text = row.text;
          if (typeof text === "string" && text.trim()) {
            firstUserTextBySession.set(row.session_id, {
              text,
              partId: row.part_id,
              source: `part#${row.part_id}`,
            });
          }
        }
      } catch {
        // optional degradation
      }
      try {
        const errParts = queryDb(
          dbPath,
          `SELECT p.session_id AS session_id, p.id AS part_id, p.time_created AS time_created,
                  json_extract(p.data, '$.state.status') AS status
             FROM part p
            WHERE json_extract(p.data, '$.type') = 'tool'
              AND (
                    json_extract(p.data, '$.error') IS NOT NULL
                 OR lower(coalesce(json_extract(p.data, '$.state.status'), '')) IN ('error','failed','errored')
                 OR lower(coalesce(cast(json_extract(p.data, '$.state.error') AS TEXT), '')) != ''
              );`,
        );
        for (const row of errParts) {
          if (!row.session_id) continue;
          const list = errorPartsBySession.get(row.session_id) || [];
          list.push({ partId: row.part_id, status: row.status, time_created: row.time_created });
          errorPartsBySession.set(row.session_id, list);
        }
      } catch {
        // optional degradation
      }
    }
    return {
      available: true,
      reason: null,
      projects,
      sessions,
      firstUserTextBySession,
      errorPartsBySession,
      tables: [...tableNames].sort(),
    };
  } catch (err) {
    return emptyDb(String(err.message || err));
  }
}

export function toMs(t) {
  if (t == null || t === "") return 0;
  if (typeof t === "string" && t.includes("-")) {
    const parsed = Date.parse(t);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function samePath(a, b) {
  if (!a || !b) return false;
  const na = path.resolve(String(a));
  const nb = path.resolve(String(b));
  return na === nb;
}

function sessionsForProject(db, projectPath) {
  const byId = new Map((db.projects || []).map((p) => [p.id, p]));
  return (db.sessions || []).filter((s) => {
    if (samePath(s.directory, projectPath)) return true;
    const proj = byId.get(s.project_id);
    if (proj && samePath(proj.worktree, projectPath)) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

export function taskIdSuffix(taskId) {
  if (typeof taskId !== "string") return null;
  if (taskId.startsWith("ses-")) return taskId.slice(4);
  return null;
}

export function exactSessionMatch(taskId, sessions, projects) {
  const suffix = taskIdSuffix(taskId);
  if (!suffix) return null;
  const session = (sessions || []).find((s) => typeof s.id === "string" && s.id.endsWith(suffix));
  if (!session) return null;
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  const proj = byId.get(session.project_id);
  const projectPath = session.directory || (proj && proj.worktree) || null;
  return {
    method: "exact",
    confidence: 1.0,
    sessionId: session.id,
    projectPath,
    evidence: [`session#${session.id}`],
  };
}

export function titleSimilarity(a, b) {
  return wordOverlapScore(a || "", b || "");
}

export function projectTimeMatch(task, sessions, projects) {
  const projectPath = task.projectPath;
  if (!projectPath) return null;
  const byId = new Map((projects || []).map((p) => [p.id, p]));
  const candidates = (sessions || []).filter((s) => {
    if (samePath(s.directory, projectPath)) return true;
    const proj = byId.get(s.project_id);
    if (proj && samePath(proj.worktree, projectPath)) return true;
    return false;
  });
  if (!candidates.length) return null;
  const t = task.mtimeMs || 0;
  candidates.sort((a, b) => {
    const da = Math.abs(toMs(a.time_updated) - t);
    const db_ = Math.abs(toMs(b.time_updated) - t);
    if (da !== db_) return da - db_;
    return String(a.id).localeCompare(String(b.id));
  });
  const best = candidates[0];
  const taskTitle = [
    task.state && task.state.approvedStrategy && task.state.approvedStrategy.strategy,
    ...(task.requirements || []).map((r) => r.title),
    task.state && task.state.nextAction,
  ]
    .filter(Boolean)
    .join(" ");
  const sim = titleSimilarity(best.title || "", taskTitle);
  const confidence = Number((0.3 + 0.4 * Math.max(0, Math.min(1, sim))).toFixed(4));
  return {
    method: "project-time",
    confidence,
    sessionId: best.id,
    projectPath: projectPath,
    evidence: [`session#${best.id}`],
  };
}

export function correlateTask(task, db) {
  if (!db || !db.available) {
    return { method: "orphan", confidence: 0, sessionId: null, reason: db && db.reason ? db.reason : "db_unavailable" };
  }
  const exact = exactSessionMatch(task.taskId, db.sessions, db.projects);
  if (exact) return exact;
  const fallback = projectTimeMatch(task, db.sessions, db.projects);
  if (fallback) return fallback;
  return { method: "orphan", confidence: 0, sessionId: null, reason: "no_session_match" };
}

function ambiguity(projectTasks, sessions, projects) {
  const map = new Map();
  for (const t of projectTasks) {
    if (!t.match || !t.match.sessionId) continue;
    if (t.match.method !== "exact" && t.match.method !== "project-time") continue;
    const sid = t.match.sessionId;
    if (!map.has(sid)) {
      map.set(sid, { sessionId: sid, methods: new Set(), projectPaths: new Set(), tasks: [] });
    }
    const e = map.get(sid);
    e.methods.add(t.match.method);
    e.projectPaths.add(t.projectPath);
    e.tasks.push(t.taskId);
  }
  const ambiguous = new Map();
  for (const [sid, entry] of map) {
    if (entry.projectPaths.size > 1) {
      const isExact = entry.methods.has("exact");
      ambiguous.set(sid, {
        ambiguous: true,
        method: isExact ? "exact-ambiguous" : "project-time-ambiguous",
        confidence: isExact ? 0.5 : 0.25,
        sessionId: sid,
        evidence: entry.tasks.map((tid) => `session#${sid}`),
      });
    }
  }
  return ambiguous;
}

// ---------------------------------------------------------------------------
// Axis A — direction
// ---------------------------------------------------------------------------

export function tokenize(text) {
  if (!text || typeof text !== "string") return [];
  const words = text.toLowerCase().match(/[a-záéíóúñü0-9]+/gi) || [];
  return words.filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function wordOverlapScore(a, b) {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function directionFromScore(score, { hasStrategy, hasObjective, corrupt }) {
  if (corrupt) return "UNKNOWN";
  if (!hasStrategy) return "NO_STRATEGY";
  if (!hasObjective) return "UNKNOWN";
  if (score >= ALIGNED_THRESHOLD) return "ALIGNED";
  if (score >= WEAK_THRESHOLD) return "WEAK";
  return "DIVERGENT";
}

export function assessDirection(task, db, match) {
  const src = `${task.statePath}:${lineOf(task.raw, "approvedStrategy")}`;
  if (task.corrupt) {
    return {
      verdict: "UNKNOWN",
      score: 0,
      evidence: sortEvidence([evidenceOf(src, `corrupt state: ${task.reason}`)]),
    };
  }
  if (!match || !match.sessionId || match.method === "orphan") {
    return {
      verdict: "UNKNOWN",
      score: 0,
      evidence: sortEvidence([evidenceOf(`${task.statePath}:${lineOf(task.raw, "phase")}`, "no session correlation")]),
    };
  }
  const strategy = task.state && task.state.approvedStrategy;
  const strategyText = strategy && typeof strategy.strategy === "string" ? strategy.strategy : "";
  const hasStrategy = Boolean(strategyText.trim());
  const reqTitles = (task.requirements || []).map((r) => r.title || "").join(" ");
  const objectiveSide = `${strategyText} ${reqTitles}`.trim();
  const user = db && db.firstUserTextBySession ? db.firstUserTextBySession.get(match.sessionId) : null;
  const userText = user && user.text ? user.text : "";
  const hasObjective = Boolean(userText.trim());
  const score = Number(wordOverlapScore(objectiveSide, userText).toFixed(4));
  const verdict = directionFromScore(score, { hasStrategy, hasObjective, corrupt: false });
  const evidence = [];
  if (hasStrategy) {
    evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "approvedStrategy")}`, strategyText));
  } else {
    evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "phase")}`, "approvedStrategy missing or empty"));
  }
  if (hasObjective) {
    evidence.push(evidenceOf(user.source || `session#${match.sessionId}`, userText));
  } else {
    evidence.push(evidenceOf(`session#${match.sessionId}`, "no first user text part"));
  }
  return { verdict, score, evidence: sortEvidence(evidence) };
}

// ---------------------------------------------------------------------------
// Axis B — completion
// ---------------------------------------------------------------------------

export function assessCompletion(task, match, session, nowIso) {
  const srcPhase = `${task.statePath}:${lineOf(task.raw, "phase")}`;
  if (task.corrupt || !task.state) {
    return {
      verdict: "UNKNOWN",
      evidence: sortEvidence([evidenceOf(srcPhase, `corrupt or missing state: ${task.reason || "no state"}`)]),
    };
  }
  const phase = task.state.phase || null;
  const reqs = task.requirements || [];
  const allVerified = reqs.length > 0 && reqs.every(requirementVerified);
  const hasArtifact = Boolean(task.artifacts["summary.md"] || task.artifacts["recent-changes.md"]);
  const hasSupport = hasArtifact || allVerified;
  const nowMs = Date.parse(nowIso) || Date.now();

  if (phase === "DONE") {
    if (hasSupport) {
      const evidence = [];
      if (task.artifacts["summary.md"]) {
        evidence.push(evidenceOf(path.join(task.taskDir, "summary.md") + ":1", "artifact present"));
      }
      if (task.artifacts["recent-changes.md"]) {
        evidence.push(evidenceOf(path.join(task.taskDir, "recent-changes.md") + ":1", "artifact present"));
      }
      if (allVerified) {
        evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "requirements")}`, "all requirements verified or have evidence"));
      }
      if (!evidence.length) evidence.push(evidenceOf(srcPhase, "phase=DONE"));
      return { verdict: "COMPLETED", evidence: sortEvidence(evidence) };
    }
    return {
      verdict: "FALSE_SUCCESS",
      evidence: sortEvidence([
        evidenceOf(srcPhase, "phase=DONE"),
        evidenceOf(`${task.taskDir}:artifacts`, "no summary.md / recent-changes.md / verified requirements"),
      ]),
    };
  }

  const ageDays = task.mtimeMs ? (nowMs - task.mtimeMs) / 86400000 : 0;
  const sessionUpdated = session ? toMs(session.time_updated) : 0;
  const sessionAgeDays = sessionUpdated ? (nowMs - sessionUpdated) / 86400000 : Infinity;
  const sessionActive = Boolean(match && match.sessionId && sessionAgeDays <= STALE_DAYS);

  if (phase !== "DONE" && ageDays > STALE_DAYS && !sessionActive) {
    return {
      verdict: "ABANDONED",
      evidence: sortEvidence([
        evidenceOf(`${task.taskDir}:mtime`, `last touched ${ageDays.toFixed(1)} days ago (threshold ${STALE_DAYS})`),
        evidenceOf(srcPhase, `phase=${phase || "unknown"}`),
      ]),
    };
  }
  const evidence = [evidenceOf(srcPhase, `phase=${phase || "unknown"}`)];
  if (sessionActive) {
    evidence.push(evidenceOf(`session#${match.sessionId}`, `session active (age ${sessionAgeDays.toFixed(1)}d)`));
  }
  return { verdict: "INCOMPLETE", evidence: sortEvidence(evidence) };
}

// ---------------------------------------------------------------------------
// Axis C — retry
// ---------------------------------------------------------------------------

function failureSignalCount(task, db, match) {
  const hyp = (task.state && task.state.hypotheses) || [];
  const exp = (task.state && task.state.experiments) || [];
  let fromHx = 0;
  if (Array.isArray(hyp)) {
    fromHx += hyp.filter((h) => /fail|reject|abort/i.test(String((h && (h.status || h.outcome)) || ""))).length;
  }
  if (Array.isArray(exp)) {
    fromHx += exp.filter((e) => /fail|reject|abort/i.test(String((e && (e.status || e.outcome)) || ""))).length;
  }
  const sessionId = match && match.sessionId;
  const errParts = sessionId && db && db.errorPartsBySession ? db.errorPartsBySession.get(sessionId) || [] : [];
  const gates = (task.state && task.state.activeGates) || [];
  const questions = (task.state && task.state.questions) || [];
  const gateSignal = Array.isArray(gates) && gates.length ? 1 : 0;
  const qSignal = Array.isArray(questions) && questions.length ? 1 : 0;
  return {
    fromHx,
    errorParts: errParts.length,
    gateSignal,
    qSignal,
    total: fromHx + errParts.length + gateSignal + qSignal,
    errParts,
    gates,
    questions,
    hyp,
    exp,
  };
}

export function retryFromSignals({ failureCount, completed, hasHypotheses }) {
  if (completed && failureCount === 0) return "NO_RETRY_NEEDED";
  if (failureCount >= 3 && !completed) return "LOOPED_NO_PROGRESS";
  if (completed && failureCount > 0) return "RETRIED_AND_SUCCEEDED";
  if (!completed && failureCount > 0) return "RETRIED_AND_FAILED";
  if (!hasHypotheses && failureCount === 0 && !completed) return "UNKNOWN";
  return "UNKNOWN";
}

export function assessRetry(task, db, match, completion) {
  const src = `${task.statePath}:${lineOf(task.raw, "phase")}`;
  if (task.corrupt || !task.state) {
    return {
      verdict: "UNKNOWN",
      evidence: sortEvidence([evidenceOf(src, `corrupt or missing state: ${task.reason || "no state"}`)]),
    };
  }
  const sig = failureSignalCount(task, db, match);
  const completed = completion && completion.verdict === "COMPLETED";
  const hasHx = (sig.hyp && sig.hyp.length > 0) || (sig.exp && sig.exp.length > 0);
  const verdict = retryFromSignals({
    failureCount: sig.total,
    completed,
    hasHypotheses: hasHx,
  });
  const evidence = [];
  if (hasHx) {
    evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "hypotheses")}`, `${sig.hyp.length} hypotheses, ${sig.exp.length} experiments, ${sig.fromHx} failures`));
  }
  if (sig.errorParts > 0 && match && match.sessionId) {
    const first = sig.errParts[0];
    evidence.push(evidenceOf(first ? `part#${first.partId}` : `session#${match.sessionId}`, `${sig.errorParts} error-like tool parts`));
  }
  if (sig.gateSignal) {
    evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "activeGates")}`, `${sig.gates.length} active gates`));
  }
  if (sig.qSignal) {
    evidence.push(evidenceOf(`${task.statePath}:${lineOf(task.raw, "questions")}`, `${sig.questions.length} pending questions`));
  }
  if (!evidence.length) {
    evidence.push(evidenceOf(src, "no failure signals or retry indicators"));
  }
  return { verdict, evidence: sortEvidence(evidence) };
}

// ---------------------------------------------------------------------------
// Per-project analysis
// ---------------------------------------------------------------------------

function zeroCounts(keys) {
  const o = {};
  for (const k of keys) o[k] = 0;
  return o;
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function sessionById(db, id) {
  if (!id) return null;
  return (db.sessions || []).find((s) => s.id === id) || null;
}

export function analyzeProject(projectPath, wamRoot, db, nowIso) {
  const { tasks } = discoverTasks(wamRoot);
  const analyzed = [];
  const orphanTasks = [];
  const matchedSessionIds = new Set();
  let corruptCount = 0;

  for (const t of tasks) {
    const match = correlateTask(t, db);
    const session = sessionById(db, match.sessionId);
    const completion = assessCompletion(t, match, session, nowIso);
    const direction = assessDirection(t, db, match);
    const retry = assessRetry(t, db, match, completion);
    const errors = [];
    if (t.corrupt) {
      errors.push({ corrupt: true, reason: t.reason });
      corruptCount += 1;
    }
    if (match.method === "orphan") {
      orphanTasks.push({ taskId: t.taskId, reason: match.reason || "no_session_match", path: t.taskDir });
    } else if (match.sessionId) {
      matchedSessionIds.add(match.sessionId);
    }
    analyzed.push({
      taskId: t.taskId,
      sessionId: match.sessionId || null,
      match: {
        method: match.method,
        confidence: match.confidence,
        ...(match.reason ? { reason: match.reason } : {}),
      },
      state: {
        phase: t.state ? t.state.phase || null : null,
        contractStatus: t.state && t.state.contract ? t.state.contract.status || null : null,
        artifacts: t.artifacts,
      },
      direction,
      completion,
      retry,
      errors,
    });
  }

  analyzed.sort((a, b) => a.taskId.localeCompare(b.taskId));
  orphanTasks.sort((a, b) => a.taskId.localeCompare(b.taskId));

  const orphanSessions = [];
  if (db && db.available) {
    for (const s of sessionsForProject(db, projectPath)) {
      if (!matchedSessionIds.has(s.id)) {
        orphanSessions.push({
          sessionId: s.id,
          reason: "no_task_match",
          directory: s.directory || null,
        });
      }
    }
    orphanSessions.sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
  }

  // Cross-project ambiguity detection: a sessionId matched from this project's
  // tasks is also matched by tasks from another project (different projectPath).
  const ambiguousBySession = ambiguity(
    analyzed.map((a) => {
      const t = tasks.find((x) => x.taskId === a.taskId);
      return {
        taskId: a.taskId,
        projectPath: t ? t.projectPath : projectPath,
        match: a.match,
      };
    }),
    db ? db.sessions : [],
    db ? db.projects : [],
  );
  let ambiguousMatches = 0;
  if (ambiguousBySession.size > 0) {
    for (const a of analyzed) {
      const amb = a.sessionId ? ambiguousBySession.get(a.sessionId) : null;
      if (amb) {
        a.match = {
          method: amb.method,
          confidence: amb.confidence,
          ambiguous: true,
          ...(a.match.reason ? { reason: a.match.reason } : {}),
        };
        ambiguousMatches += 1;
      }
    }
  }

  const matched = analyzed.filter((a) => a.match.method !== "orphan" && !a.match.ambiguous).length;
  return {
    project: projectPath,
    wamPath: wamRoot,
    coverage: {
      tasks: tasks.length,
      matched,
      orphanTasks: orphanTasks.length,
      orphanSessions: orphanSessions.length,
      ambiguousMatches,
      corrupt: corruptCount,
    },
    tasks: analyzed,
    orphanTasks,
    orphanSessions,
  };
}

// ---------------------------------------------------------------------------
// Aggregate run
// ---------------------------------------------------------------------------

export function slugify(p) {
  return String(p).replace(/^\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";
}

export const DEFAULT_GATE_CONFIG = {
  maxNoStrategyRatio: 0.9,
  maxLoopedNoProgress: 0,
  maxAmbiguousMatches: 50,
};

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function loadGateConfig(configPath) {
  const p = configPath
    ? path.resolve(configPath)
    : path.resolve(process.cwd(), ".wam-audit.config.json");
  const parsed = fs.existsSync(p) ? readJsonSafe(p) : null;
  return {
    ...DEFAULT_GATE_CONFIG,
    ...(parsed && typeof parsed === "object" ? parsed : {}),
  };
}

export function evaluateGate(totals = {}, config = {}) {
  const cfg = { ...DEFAULT_GATE_CONFIG, ...config };
  const violations = [];
  const tasks = Number(totals.tasks) || 0;
  const noStrategy = Number(totals.direction && totals.direction.NO_STRATEGY) || 0;
  const ratio = tasks > 0 ? noStrategy / tasks : 0;
  if (ratio > cfg.maxNoStrategyRatio) {
    violations.push({
      metric: "NO_STRATEGY_RATIO",
      actual: ratio,
      limit: cfg.maxNoStrategyRatio,
      kind: "threshold",
    });
  }
  const looped = Number(totals.retry && totals.retry.LOOPED_NO_PROGRESS) || 0;
  if (looped > cfg.maxLoopedNoProgress) {
    violations.push({
      metric: "LOOPED_NO_PROGRESS",
      actual: looped,
      limit: cfg.maxLoopedNoProgress,
      kind: "threshold",
    });
  }
  const ambiguous = Number(totals.ambiguousMatches) || 0;
  if (ambiguous > cfg.maxAmbiguousMatches) {
    violations.push({
      metric: "AMBIGUOUS_MATCHES",
      actual: ambiguous,
      limit: cfg.maxAmbiguousMatches,
      kind: "threshold",
    });
  }
  return { passed: violations.length === 0, violations, config: cfg };
}

export function compareBaseline(totals = {}, baseline = {}) {
  const base = baseline.totals || baseline;
  const checks = [
    ["NO_STRATEGY", totals.direction && totals.direction.NO_STRATEGY, base.direction && base.direction.NO_STRATEGY],
    ["LOOPED_NO_PROGRESS", totals.retry && totals.retry.LOOPED_NO_PROGRESS, base.retry && base.retry.LOOPED_NO_PROGRESS],
    ["RETRIED_AND_FAILED", totals.retry && totals.retry.RETRIED_AND_FAILED, base.retry && base.retry.RETRIED_AND_FAILED],
    ["AMBIGUOUS_MATCHES", totals.ambiguousMatches, base.ambiguousMatches],
  ];
  const violations = [];
  for (const [metric, actualRaw, baseRaw] of checks) {
    const actual = Number(actualRaw) || 0;
    const baseValue = Number(baseRaw) || 0;
    if (actual > baseValue) {
      violations.push({ metric, actual, baseline: baseValue, kind: "regression" });
    }
  }
  return violations;
}

export function runAudit(opts = {}) {
  const root = path.resolve(opts.root || DEFAULT_ROOT);
  const nowIso = opts.now || new Date().toISOString();
  const projectFilter = opts.project || null;
  const dbPath = opts.dbPath || DEFAULT_DB_PATH;
  const dryRun = Boolean(opts.dryRun);
  const outDir = opts.out ? path.resolve(opts.out) : path.resolve(process.cwd(), "audit", "wam-audit");

  const wamRoots = discoverWamRoots(root);
  const projectPaths = wamRoots
    .map((w) => path.dirname(w))
    .filter((p) => projectMatchesFilter(p, projectFilter));
  const uniqueProjects = [...new Set(projectPaths)].sort((a, b) => a.localeCompare(b));

  const db = loadOpencodeDb(dbPath);

  const totals = {
    projects: 0,
    tasks: 0,
    matched: 0,
    orphans: 0,
    orphanTasks: 0,
    orphanSessions: 0,
    ambiguousMatches: 0,
    distinctSessions: 0,
    direction: zeroCounts(DIRECTION_VERDICTS),
    completion: zeroCounts(COMPLETION_VERDICTS),
    retry: zeroCounts(RETRY_VERDICTS),
  };

  const projectReports = [];
  for (const projectPath of uniqueProjects) {
    const wamRoot = path.join(projectPath, ".wam");
    const report = analyzeProject(projectPath, wamRoot, db, nowIso);
    projectReports.push(report);
    totals.projects += 1;
    totals.tasks += report.coverage.tasks;
    totals.matched += report.coverage.matched;
    totals.orphans += report.coverage.orphanTasks;
    totals.orphanTasks += report.coverage.orphanTasks;
    totals.orphanSessions += report.coverage.orphanSessions;
    totals.ambiguousMatches += report.coverage.ambiguousMatches;
    for (const t of report.tasks) {
      bump(totals.direction, t.direction.verdict);
      bump(totals.completion, t.completion.verdict);
      bump(totals.retry, t.retry.verdict);
    }
  }

  // distinctSessions: count of unique sessionIds across all matched tasks
  // (excludes orphan tasks, includes ambiguous ones — distinct session dimension).
  const seenSessions = new Set();
  for (const pr of projectReports) {
    for (const t of pr.tasks || []) {
      if (t.sessionId) seenSessions.add(t.sessionId);
    }
  }
  totals.distinctSessions = seenSessions.size;

  // Cross-project ambiguity: a sessionId may have been matched from tasks
  // in more than one project. If so, demote every such match to ambiguous.
  // Build the global sessionId -> projectPaths map from all tasks.
  const globalSessionProjects = new Map();
  for (const pr of projectReports) {
    for (const t of pr.tasks || []) {
      if (!t.sessionId) continue;
      if (t.match && t.match.method === "orphan") continue;
      if (!globalSessionProjects.has(t.sessionId)) {
        globalSessionProjects.set(t.sessionId, new Set());
      }
      globalSessionProjects.get(t.sessionId).add(pr.project);
    }
  }
  let additionalAmbiguous = 0;
  for (const [sid, pps] of globalSessionProjects) {
    if (pps.size > 1) {
      for (const pr of projectReports) {
        for (const t of pr.tasks || []) {
          if (t.sessionId !== sid) continue;
          if (t.match && t.match.ambiguous) continue;
          const isExact = t.match && t.match.method === "exact";
          t.match = {
            method: isExact ? "exact-ambiguous" : "project-time-ambiguous",
            confidence: isExact ? 0.5 : 0.25,
            ambiguous: true,
          };
          additionalAmbiguous += 1;
        }
      }
    }
  }
  // Recompute per-project coverage.matched and totals.ambiguousMatches
  totals.ambiguousMatches = 0;
  for (const pr of projectReports) {
    let amb = 0;
    let matched = 0;
    for (const t of pr.tasks || []) {
      if (t.match && t.match.ambiguous) amb += 1;
      else if (t.match && t.match.method !== "orphan") matched += 1;
    }
    pr.coverage.matched = matched;
    pr.coverage.ambiguousMatches = amb;
    totals.ambiguousMatches += amb;
  }

  let gate = null;
  if (opts.gate) {
    const config = loadGateConfig(opts.config);
    const violations = [...evaluateGate(totals, config).violations];
    if (opts.baseline) {
      const baselinePath = path.resolve(opts.baseline);
      const baseline = fs.existsSync(baselinePath) ? readJsonSafe(baselinePath) : null;
      if (baseline) violations.push(...compareBaseline(totals, baseline));
    }
    gate = { passed: violations.length === 0, violations, config };
  }

  const aggregate = redactDeep({
    schemaVersion: SCHEMA_VERSION,
    root,
    projectFilter,
    totals,
    ...(gate ? { gate } : {}),
    projects: projectReports,
  });

  if (!dryRun) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "wam-audit.json"), JSON.stringify(aggregate, null, 2) + "\n");
    const perDir = path.join(outDir, "projects");
    fs.mkdirSync(perDir, { recursive: true });
    for (const pr of projectReports) {
      const body = redactDeep(pr);
      fs.writeFileSync(path.join(perDir, `${slugify(pr.project)}.json`), JSON.stringify(body, null, 2) + "\n");
    }
  }

  return aggregate;
}

function printSummary(result, extra) {
  const summary = {
    schemaVersion: result.schemaVersion,
    totals: result.totals,
    ...extra,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (isMain()) {
  const opts = parseArgs(process.argv.slice(2));
  const result = runAudit(opts);
  printSummary(result, {
    dryRun: Boolean(opts.dryRun),
    out: opts.dryRun ? null : path.resolve(opts.out || path.join(process.cwd(), "audit", "wam-audit")),
    ...(result.gate ? { gate: result.gate } : {}),
  });
  if (opts.gate && result.gate && !result.gate.passed) process.exit(2);
  process.exit(0);
}
