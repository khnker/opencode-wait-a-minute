/**
 * Historical intent retrieval.
 *
 * Hybrid score: BM25-ish lexical overlap + recency. Entries below the threshold
 * are dropped, so unrelated history is never injected.
 */

import fs from "node:fs";
import path from "node:path";

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
  "de", "la", "el", "los", "las", "un", "una", "y", "o", "en", "para",
  "que", "con", "por", "del", "al", "se", "es", "son", "como", "mas",
]);

export function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9._/-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function idfFor(entries) {
  const docs = entries.map((e) => new Set(tokenize(e.text)));
  const df = new Map();
  for (const doc of docs) for (const term of doc) df.set(term, (df.get(term) || 0) + 1);
  const n = docs.length || 1;
  const idf = new Map();
  for (const [term, count] of df) idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  return { idf, docs };
}

/**
 * @param {Array<{text:string, timestamp?:string|number, source?:string}>} entries
 * @param {string} query
 * @param {{ limit?:number, threshold?:number, now?:number }} [opts]
 */
export function retrieveIntentHistory(entries, query, opts = {}) {
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.text) : [];
  if (!list.length) return [];
  const limit = opts.limit ?? 3;
  const threshold = opts.threshold ?? 0.35;
  const now = opts.now ?? Date.now();
  const queryTokens = [...new Set(tokenize(query))];
  if (!queryTokens.length) return [];

  const { idf, docs } = idfFor(list);
  const scored = list.map((entry, i) => {
    const doc = docs[i];
    let lexical = 0;
    for (const term of queryTokens) if (doc.has(term)) lexical += idf.get(term) || 1;
    const normalized = lexical / queryTokens.length;
    if (lexical <= 0) return { ...entry, score: 0 };
    const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
    const ageDays = ts ? Math.max(0, (now - ts) / 86400000) : 365;
    const recency = 0.5 * Math.exp(-ageDays / 14);
    return { ...entry, score: normalized + recency };
  });

  return scored
    .filter((e) => e.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Load bounded history from recent-changes.md and prior task contracts.
 */
export function loadHistoryEntries(root, opts = {}) {
  const taskId = opts.taskId || null;
  const includeOtherTasks = opts.includeOtherTasks === true;
  const entries = [];
  const recent = path.join(root, ".wam", "context", "recent-changes.md");
  try {
    const body = fs.readFileSync(recent, "utf8");
    for (const section of body.split(/\n(?=## )/)) {
      if (!section.startsWith("## ")) continue;
      const [heading, ...rest] = section.split("\n");
      const date = heading.match(/##\s+(\d{4}-\d{2}-\d{2})/)?.[1];
      const scope = heading.split("—")[1]?.trim() || null;
      if (taskId && scope && scope !== taskId) continue;
      entries.push({ text: rest.join("\n").trim(), timestamp: date, source: "recent-changes" });
    }
  } catch {}

  const tasksDir = path.join(root, ".wam", "tasks");
  try {
    for (const id of fs.readdirSync(tasksDir)) {
      if (!includeOtherTasks && (!taskId || id !== taskId)) continue;
      const file = path.join(tasksDir, id, "task.json");
      let task;
      try { task = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      const objective = task?.contract?.objective || "";
      const requirements = (task?.contract?.requirements || []).join("; ");
      const text = [objective, requirements, task?.lastAction].filter(Boolean).join(" — ");
      if (!text) continue;
      entries.push({
        text,
        timestamp: task?.contract?.createdAt || task?.createdAt || task?.updatedAt,
        source: `task:${id}`,
      });
    }
  } catch {}

  return entries.slice(0, 200);
}
