#!/usr/bin/env node
/**
 * WAM Audit Evidence Reports — pure Markdown renderer + CLI.
 *
 * Consumes ONLY the audit JSON. Never re-reads .wam or the OpenCode DB.
 * Identical JSON + identical --now => byte-identical Markdown.
 *
 * node scripts/wam-audit-report.mjs --data <wam-audit.json>
 *   [--reports-out DIR] [--index PATH] [--now ISO]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { redact, slugify, isMain as engineIsMain } from "./wam-audit.mjs";

export const DEFAULT_INDEX = path.join(os.homedir(), ".local", "share", "wam", "audit", "index.md");

export function parseReportArgs(argv) {
  const args = { data: null, reportsOut: null, index: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data") args.data = argv[++i];
    else if (a === "--reports-out") args.reportsOut = argv[++i];
    else if (a === "--index") args.index = argv[++i];
    else if (a === "--now") args.now = argv[++i];
  }
  return args;
}

export function isMain(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return engineIsMain(metaUrl, argv1);
}

function r(s) {
  return redact(s == null ? "" : String(s));
}

function countBy(tasks, axis, verdict) {
  return (tasks || []).filter((t) => t[axis] && t[axis].verdict === verdict).length;
}

function tally(tasks, axis) {
  const out = {};
  for (const t of tasks || []) {
    const v = t[axis] && t[axis].verdict ? t[axis].verdict : "UNKNOWN";
    out[v] = (out[v] || 0) + 1;
  }
  return out;
}

function fmtCounts(map) {
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
  if (!keys.length) return "_none_";
  return keys.map((k) => `- ${k}: ${map[k]}`).join("\n");
}

function evidenceLines(verdictObj) {
  const list = verdictObj && Array.isArray(verdictObj.evidence) ? verdictObj.evidence : [];
  if (!list.length) {
    return ["- UNKNOWN — no evidence cited; absence of evidence is stated explicitly."];
  }
  return list.map((e) => {
    const src = r(e && e.source ? e.source : "(missing source)");
    const quote = r(e && e.quote ? e.quote : "");
    return `- \`${src}\` — ${quote}`;
  });
}

function effectiveVerdict(verdictObj) {
  if (!verdictObj || !verdictObj.verdict) return "UNKNOWN";
  const list = Array.isArray(verdictObj.evidence) ? verdictObj.evidence : [];
  if (!list.length) return "UNKNOWN";
  return verdictObj.verdict;
}

function isGitRepo(p) {
  try {
    return fs.statSync(path.join(p, ".git")).isDirectory();
  } catch {
    return false;
  }
}

function isGitIgnored(p, target) {
  try {
    execFileSync("git", ["-C", p, "check-ignore", "-q", target], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function auditHomeDir() {
  return process.env.WAM_AUDIT_HOME || path.join(os.homedir(), ".local", "share", "wam", "audit");
}

function fallbackReportPath(projectPath) {
  const slug = slugify(projectPath);
  return path.join(auditHomeDir(), "reports", `${slug}.md`);
}

function resolveReportDest(projectPath, reportsOut) {
  if (reportsOut) {
    return { dest: path.join(reportsOut, slugify(projectPath), "wam-behavior-report.md"), fallback: false };
  }
  const inPlace = path.join(projectPath, ".wam", "audit", "wam-behavior-report.md");
  if (isGitRepo(projectPath) && !isGitIgnored(projectPath, path.join(".wam", "audit"))) {
    return { dest: fallbackReportPath(projectPath), fallback: true };
  }
  return { dest: inPlace, fallback: false };
}

function reproductionCommand(audit, nowIso, dataPath, reportsOut, indexPath) {
  const root = audit.root || "/home/nicolas/dev";
  const proj = audit.projectFilter ? ` --project ${shellTok(audit.projectFilter)}` : "";
  const now = nowIso ? ` --now ${shellTok(nowIso)}` : "";
  const engine = `node scripts/wam-audit.mjs --root ${shellTok(root)}${proj} --out ${shellTok(path.dirname(dataPath || "audit/wam-audit/wam-audit.json"))}${now}`;
  const report = `node scripts/wam-audit-report.mjs --data ${shellTok(dataPath || "audit/wam-audit/wam-audit.json")}${reportsOut ? ` --reports-out ${shellTok(reportsOut)}` : ""}${indexPath ? ` --index ${shellTok(indexPath)}` : ""}${now}`;
  return { engine, report };
}

function shellTok(s) {
  const str = String(s);
  if (/^[A-Za-z0-9_./:@-]+$/.test(str)) return str;
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

export function renderProjectMarkdown(project, audit, nowIso, ctx = {}) {
  const name = r(project.project || "(unknown)");
  const cov = project.coverage || {};
  const tasks = [...(project.tasks || [])].sort((a, b) => String(a.taskId).localeCompare(String(b.taskId)));
  const dirT = tally(tasks, "direction");
  const comT = tally(tasks, "completion");
  const retT = tally(tasks, "retry");
  const { engine, report } = reproductionCommand(audit, nowIso, ctx.dataPath, ctx.reportsOut, ctx.indexPath);

  const lines = [];
  lines.push(`# WAM Behavior Report: ${name}`);
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Tasks: ${cov.tasks ?? tasks.length}`);
  lines.push(`- Matched: ${cov.matched ?? 0}`);
  lines.push(`- Orphan tasks: ${cov.orphanTasks ?? (project.orphanTasks || []).length}`);
  lines.push(`- Orphan sessions: ${cov.orphanSessions ?? (project.orphanSessions || []).length}`);
  lines.push(`- Ambiguous matches: ${cov.ambiguousMatches ?? 0}`);
  lines.push(`- Corrupt: ${cov.corrupt ?? 0}`);
  if (project.orphanTasks && project.orphanTasks.length) {
    lines.push("");
    lines.push("Orphan tasks:");
    const orphans = [...project.orphanTasks].sort((a, b) => String(a.taskId).localeCompare(String(b.taskId)));
    for (const o of orphans) {
      lines.push(`- \`${r(o.taskId)}\` — ${r(o.reason || "unmatched")}`);
    }
  }
  if (project.orphanSessions && project.orphanSessions.length) {
    lines.push("");
    lines.push("Orphan sessions:");
    const osess = [...project.orphanSessions].sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
    for (const o of osess) {
      lines.push(`- \`${r(o.sessionId)}\` — ${r(o.reason || "unmatched")}`);
    }
  }
  lines.push("");
  lines.push("## Verdict Summary");
  lines.push("");
  lines.push("Direction:");
  lines.push(fmtCounts(dirT));
  lines.push("");
  lines.push("Completion:");
  lines.push(fmtCounts(comT));
  lines.push("");
  lines.push("Retry:");
  lines.push(fmtCounts(retT));
  if (countBy(tasks, "completion", "FALSE_SUCCESS") > 0) {
    lines.push("");
    lines.push("False-success tasks:");
    for (const t of tasks.filter((x) => x.completion && x.completion.verdict === "FALSE_SUCCESS")) {
      lines.push(`- \`${r(t.taskId)}\``);
    }
  }
  lines.push("");
  lines.push("## Tasks");
  lines.push("");
  lines.push("| Task | Session | Direction | Completion | Retry | Confidence |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const t of tasks) {
    const conf = t.match && typeof t.match.confidence === "number" ? t.match.confidence.toFixed(2) : "0.00";
    const ambFlag = t.match && t.match.ambiguous ? " (ambiguous)" : "";
    const taskCell = `${r(t.taskId)}${r(ambFlag)}`;
    lines.push(
      `| ${taskCell} | ${r(t.sessionId || "—")} | ${r(effectiveVerdict(t.direction))} | ${r(effectiveVerdict(t.completion))} | ${r(effectiveVerdict(t.retry))} | ${conf} |`,
    );
  }
  lines.push("");
  lines.push("## Evidence");
  lines.push("");
  for (const t of tasks) {
    lines.push(`### ${r(t.taskId)}`);
    lines.push("");
    lines.push(`Session: \`${r(t.sessionId || "none")}\` · match: \`${r((t.match && t.match.method) || "orphan")}\`${t.match && t.match.ambiguous ? " (ambiguous)" : ""} · confidence: ${t.match && t.match.confidence != null ? t.match.confidence : 0}`);
    lines.push("");
    lines.push(`Direction: **${r(effectiveVerdict(t.direction))}**`);
    lines.push(...evidenceLines(t.direction));
    lines.push("");
    lines.push(`Completion: **${r(effectiveVerdict(t.completion))}**`);
    lines.push(...evidenceLines(t.completion));
    lines.push("");
    lines.push(`Retry: **${r(effectiveVerdict(t.retry))}**`);
    lines.push(...evidenceLines(t.retry));
    lines.push("");
  }
  lines.push("## Methodology");
  lines.push("");
  lines.push("- Correlation: exact session-id suffix after `ses-` (confidence 1.0); else same project path + nearest `time_updated` + title overlap (confidence 0.3–0.7); else orphan.");
  lines.push("- Direction: Jaccard overlap of significant words between first user text and `approvedStrategy` + requirement titles. ALIGNED ≥ 0.25, WEAK ≥ 0.05, else DIVERGENT. No strategy → NO_STRATEGY. Unmatched/corrupt/no objective → UNKNOWN.");
  lines.push("- Completion: DONE plus summary.md / recent-changes.md / verified requirements → COMPLETED; DONE without support → FALSE_SUCCESS; not DONE and session active → INCOMPLETE; not DONE and stale > 30 days with no session activity → ABANDONED.");
  lines.push("- Retry: hypothesis/experiment failure cycles when present; otherwise error-like tool parts, `activeGates`, and `questions`. COMPLETED with no failures → NO_RETRY_NEEDED; ≥3 failure signals without completion → LOOPED_NO_PROGRESS.");
  lines.push("- This report is rendered only from the audit JSON; `.wam` and the OpenCode database are not re-read.");
  lines.push("");
  lines.push("## Reproduction");
  lines.push("");
  lines.push("```");
  lines.push(engine);
  lines.push(report);
  lines.push("```");
  lines.push("");
  if (nowIso) {
    lines.push(`Generated with --now ${r(nowIso)}.`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderIndexMarkdown(audit, nowIso, ctx = {}) {
  const totals = audit.totals || {};
  const projects = [...(audit.projects || [])].sort((a, b) => String(a.project).localeCompare(String(b.project)));
  const { engine, report } = reproductionCommand(audit, nowIso, ctx.dataPath, ctx.reportsOut, ctx.indexPath);
  const lines = [];
  lines.push("# WAM Audit Index");
  lines.push("");
  lines.push(`- Schema: ${r(audit.schemaVersion || "")}`);
  lines.push(`- Root: \`${r(audit.root || "")}\``);
  lines.push(`- Project filter: ${r(audit.projectFilter || "(all)")}`);
  lines.push(`- Projects: ${totals.projects ?? projects.length}`);
  lines.push(`- Tasks: ${totals.tasks ?? 0}`);
  lines.push(`- Matched: ${totals.matched ?? 0}`);
  lines.push(`- Orphans: ${totals.orphans ?? 0}`);
  lines.push(`- Orphan tasks: ${totals.orphanTasks ?? totals.orphans ?? 0}`);
  lines.push(`- Orphan sessions: ${totals.orphanSessions ?? 0}`);
  lines.push(`- Ambiguous matches: ${totals.ambiguousMatches ?? 0}`);
  lines.push(`- Distinct sessions: ${totals.distinctSessions ?? 0}`);
  lines.push("");
  lines.push("Direction totals:");
  lines.push(fmtCounts(totals.direction || {}));
  lines.push("");
  lines.push("Completion totals:");
  lines.push(fmtCounts(totals.completion || {}));
  lines.push("");
  lines.push("Retry totals:");
  lines.push(fmtCounts(totals.retry || {}));
  lines.push("");
  lines.push("| Project | Tasks | Matched | Orphan tasks | Orphan sessions | Ambiguous | ALIGNED | COMPLETED | FALSE_SUCCESS | RETRIED_AND_SUCCEEDED | Report |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const p of projects) {
    const tasks = p.tasks || [];
    const slug = slugify(p.project);
    const reportRel = (p.coverage && p.coverage.reportPath)
      ? p.coverage.reportPath
      : (ctx.reportsOut
        ? path.join(ctx.reportsOut, slug, "wam-behavior-report.md")
        : path.join(p.project, ".wam", "audit", "wam-behavior-report.md"));
    const flag = (p.coverage && p.coverage.reportFallback) ? " (fallback)" : "";
    lines.push(
      `| ${r(p.project)} | ${p.coverage ? p.coverage.tasks : tasks.length} | ${p.coverage ? p.coverage.matched : 0} | ${p.coverage ? p.coverage.orphanTasks : 0} | ${p.coverage ? p.coverage.orphanSessions : 0} | ${p.coverage ? p.coverage.ambiguousMatches : 0} | ${countBy(tasks, "direction", "ALIGNED")} | ${countBy(tasks, "completion", "COMPLETED")} | ${countBy(tasks, "completion", "FALSE_SUCCESS")} | ${countBy(tasks, "retry", "RETRIED_AND_SUCCEEDED")} | [report](${r(reportRel)})${r(flag)} |`,
    );
  }
  lines.push("");
  lines.push("Reproduction:");
  lines.push("");
  lines.push("```");
  lines.push(engine);
  lines.push(report);
  lines.push("```");
  lines.push("");
  if (nowIso) {
    lines.push(`Generated with --now ${r(nowIso)}.`);
    lines.push("");
  }
  return lines.join("\n");
}

export function writeReports(audit, opts = {}) {
  const nowIso = opts.now || null;
  const reportsOut = opts.reportsOut || null;
  const indexPath = opts.index || DEFAULT_INDEX;
  const dataPath = opts.dataPath || "wam-audit.json";
  const ctx = { dataPath, reportsOut, indexPath };
  const written = [];

  // Resolve each project's report destination once (also annotates the
  // project JSON so consumers can find it without re-running git).
  const projectDest = new Map();
  for (const project of audit.projects || []) {
    const { dest, fallback } = resolveReportDest(project.project, reportsOut);
    projectDest.set(project.project, dest);
    if (!project.coverage) project.coverage = {};
    project.coverage.reportPath = dest;
    project.coverage.reportFallback = fallback;
  }

  for (const project of audit.projects || []) {
    const md = renderProjectMarkdown(project, audit, nowIso, ctx);
    const dest = projectDest.get(project.project);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, md);
    written.push(dest);
  }

  const indexMd = renderIndexMarkdown(audit, nowIso, ctx);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, indexMd);
  written.push(indexPath);

  // Persist updated project metadata (reportPath / reportFallback) back into
  // the source JSON so downstream tooling can find reports without re-running.
  if (dataPath && fs.existsSync(dataPath)) {
    try {
      fs.writeFileSync(dataPath, JSON.stringify(audit, null, 2) + "\n");
    } catch {
      // best-effort
    }
  }
  return written;
}

if (isMain()) {
  const args = parseReportArgs(process.argv.slice(2));
  if (!args.data) {
    process.stderr.write("usage: node scripts/wam-audit-report.mjs --data <wam-audit.json> [--reports-out DIR] [--index PATH] [--now ISO]\n");
    process.exit(2);
  }
  const raw = fs.readFileSync(args.data, "utf8");
  const audit = JSON.parse(raw);
  const nowIso = args.now || new Date().toISOString();
  const written = writeReports(audit, {
    now: nowIso,
    reportsOut: args.reportsOut || null,
    index: args.index || DEFAULT_INDEX,
    dataPath: path.resolve(args.data),
  });
  process.stdout.write(JSON.stringify({ reports: written.length, index: args.index || DEFAULT_INDEX }, null, 2) + "\n");
  process.exit(0);
}
