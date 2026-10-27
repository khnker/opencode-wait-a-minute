/**
 * Bounded conversation memory: rolling summary + entity table.
 *
 * File-based and deterministic. No transcript replay; only the last N turns and
 * relevant entities are injected.
 */

import fs from "node:fs";
import path from "node:path";

const MAX_TURNS = 10;
const MAX_ENTITIES = 20;

function safeSession(sessionID) {
  return String(sessionID || "default").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function memoryPath(root, sessionID) {
  return path.join(root || process.cwd(), ".wam", "context", `conversation-${safeSession(sessionID)}.json`);
}

export function loadConversationMemory(root, sessionID) {
  try {
    return JSON.parse(fs.readFileSync(memoryPath(root, sessionID), "utf8"));
  } catch {
    return { turns: [], entities: [], summary: "" };
  }
}

export function extractEntities(text) {
  const value = String(text || "");
  const entities = [];
  for (const m of value.matchAll(/https?:\/\/[^\s)]+/g)) entities.push({ value: m[0], kind: "url" });
  for (const m of value.matchAll(/(?:^|\s)(\/[\w./-]{3,})/g)) entities.push({ value: m[1], kind: "path" });
  for (const m of value.matchAll(/\b[\w-]+\.(?:js|mjs|cjs|ts|tsx|json|md|py|sh|yaml|yml)\b/g)) {
    entities.push({ value: m[0], kind: "file" });
  }
  const seen = new Set();
  return entities.filter((e) => {
    if (seen.has(e.value)) return false;
    seen.add(e.value);
    return true;
  });
}

export function recordTurn({ sessionID, user = "", assistant = "" }, root) {
  const memory = loadConversationMemory(root, sessionID);
  const now = new Date().toISOString();
  if (user) memory.turns.push({ role: "user", text: user, ts: now });
  if (assistant) memory.turns.push({ role: "assistant", text: assistant, ts: now });
  memory.turns = memory.turns.slice(-MAX_TURNS);

  const entities = extractEntities(`${user}\n${assistant}`);
  const byValue = new Map((memory.entities || []).map((e) => [e.value, e]));
  for (const entity of entities) byValue.set(entity.value, { ...entity, ts: now });
  memory.entities = [...byValue.values()].slice(-MAX_ENTITIES);
  memory.summary = memory.turns
    .filter((t) => t.role === "user")
    .slice(-3)
    .map((t) => t.text.slice(0, 160))
    .join(" | ");

  const file = memoryPath(root, sessionID);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(memory, null, 2));
  return memory;
}

function overlaps(query, value) {
  const q = String(query || "").toLowerCase();
  const v = String(value || "").toLowerCase();
  if (!q || !v) return false;
  return v.split(/[^a-z0-9]+/).some((part) => part.length > 3 && q.includes(part));
}

export function recallEntities(query, memory, limit = 5) {
  return (memory?.entities || [])
    .filter((e) => overlaps(query, e.value))
    .slice(0, limit);
}

export function formatMemoryForContext(memory, query, limit = 5) {
  const entities = recallEntities(query, memory, limit);
  const lines = [];
  if (memory?.summary && overlaps(query, memory.summary)) lines.push(`summary: ${memory.summary}`);
  if (entities.length) lines.push(`entities: ${entities.map((e) => `${e.kind}=${e.value}`).join(", ")}`);
  return lines.join("\n");
}
