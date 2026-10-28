/**
 * Context Pack Evidence — ordered per-turn archive of assembled context packs.
 *
 * Layout: .wam/tasks/<taskId>/context/NNNN-<promptHash>.json + index.json
 * Order is the zero-padded sequence number; index.json mirrors it.
 * Fail-soft: recording must never break message handling.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { taskDir as wamTaskDir } from "../shared/wam-paths.js";

const SEQ_WIDTH = 4;
const DEFAULT_MAX_RECORDS = 500;

function sha(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function evidenceDir(root, taskId) {
  return path.join(wamTaskDir(root, taskId), "context");
}

function readIndex(indexFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexFile, "utf-8"));
    if (Array.isArray(parsed.entries)) return parsed;
  } catch {}
  return { entries: [], updatedAt: null };
}

function nextSeq(dir) {
  let max = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      const m = /^(\d+)-/.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {}
  return max + 1;
}

function maxRecords() {
  const n = Number(process.env.WAM_CONTEXT_EVIDENCE_MAX);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_RECORDS;
}

function prune(dir, index, limit) {
  while (index.entries.length > limit) {
    const oldest = index.entries.shift();
    try {
      fs.unlinkSync(path.join(dir, oldest.file));
    } catch {}
  }
}

/**
 * Derives skill-injection cost from the emitted lines: how many full bodies
 * were paid for versus how many were deduped to a reference line.
 */
function injectionSummary(lines = []) {
  const summary = { skills: 0, refs: 0 };
  for (const line of lines) {
    const text = String(line ?? "");
    if (/\[wam N3 skill-ref\]/.test(text)) summary.refs += 1;
    else if (/\[wam N3 skill\]/.test(text)) summary.skills += 1;
  }
  return summary;
}

export function recordContextPack({ taskId, prompt = "", pack = {}, root = process.cwd() } = {}) {
  if (!taskId) return { ok: false, reason: "taskId required" };
  try {
    const dir = evidenceDir(root, taskId);
    const indexFile = path.join(dir, "index.json");
    fs.mkdirSync(dir, { recursive: true });

    const seq = nextSeq(dir);
    const promptHash = sha(prompt);
    const createdAt = new Date().toISOString();
    const file = `${String(seq).padStart(SEQ_WIDTH, "0")}-${promptHash}.json`;
    const dropped = pack.admission?.droppedItems || [];
    const injection = injectionSummary(pack.lines);

    const record = {
      seq,
      createdAt,
      taskId,
      prompt,
      promptHash,
      source: pack.source || null,
      budget: pack.budget ?? null,
      budget_used: pack.budget_used ?? null,
      budget_violation: Boolean(pack.budget_violation),
      levels: pack.levels || {},
      injected: pack.lines || [],
      injection,
      candidates: pack.candidates || [],
      dropped,
      integrity: pack.integrity || null,
      rationale: pack.rationale || [],
    };

    fs.writeFileSync(path.join(dir, file), JSON.stringify(record, null, 2), "utf-8");

    const index = readIndex(indexFile);
    index.entries.push({
      seq,
      file,
      createdAt,
      promptHash,
      budget_used: record.budget_used,
      lines: record.injected.length,
      injection,
      candidates: (pack.candidates || []).length,
      dropped: dropped.length,
      violation: record.budget_violation,
    });
    prune(dir, index, maxRecords());
    index.updatedAt = createdAt;
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), "utf-8");

    return { ok: true, seq, file: path.join(dir, file) };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Durable record of the delegation directive emitted for a task: which
 * requirements were sent to parallel subagents. One bounded file per task.
 */
export function recordDelegationEvidence({ taskId, lines = [], root = process.cwd() } = {}) {
  if (!taskId) return { ok: false, reason: "taskId required" };
  try {
    const dir = evidenceDir(root, taskId);
    fs.mkdirSync(dir, { recursive: true });
    const requirements = [];
    for (const line of lines) {
      const match = /^\s*(\S+)\s+→\s+Task\(parallel\)/.exec(String(line ?? ""));
      if (match) requirements.push(match[1]);
    }
    const file = path.join(dir, "delegation.json");
    const payload = { updatedAt: new Date().toISOString(), count: requirements.length, requirements };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf-8");
    return { ok: true, file, count: requirements.length };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export function listContextEvidence({ taskId, root = process.cwd() } = {}) {
  if (!taskId) return [];
  return readIndex(path.join(evidenceDir(root, taskId), "index.json")).entries;
}

export function readContextEvidence({ taskId, seq, root = process.cwd() } = {}) {
  const entry = listContextEvidence({ taskId, root }).find((e) => e.seq === Number(seq));
  if (!entry) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(evidenceDir(root, taskId), entry.file), "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Skill ids already injected for a task, recovered from the last persisted
 * pack. Lets the per-session dedupe survive a plugin restart.
 */
export function injectedSkillIds({ taskId, root = process.cwd() } = {}) {
  const entries = listContextEvidence({ taskId, root });
  const ids = new Set();
  // Bounded lookback: enough to cover a session's last few turns after a restart.
  for (const entry of entries.slice(-5)) {
    const record = readContextEvidence({ taskId, seq: entry.seq, root });
    for (const line of record?.injected || []) {
      const match = /^\[wam N3 skill(?:-ref)?\]\s+([\w-]+)/.exec(String(line ?? ""));
      if (match) ids.add(match[1]);
    }
  }
  return ids;
}
