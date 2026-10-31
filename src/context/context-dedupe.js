/**
 * Per-session context dedupe.
 *
 * Identical context blocks are injected at most once per session (24h TTL).
 * Critical contract/gate/clarification blocks are always kept.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const CRITICAL_RE = /⛔|COMPLETION GATE|VALIDACI[OÓ]N|ASKING|¿Apruebo este contrato\?|Contrato (aprobado|rechazado)|No declare DONE|Recomendación/i;

function safeSession(sessionID) {
  return String(sessionID || "default").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function injectedPath(root, sessionID) {
  return path.join(root || process.cwd(), ".wam", "context", `injected-${safeSession(sessionID)}.json`);
}

export function normalizeContextText(text) {
  return String(text || "")
    .replace(/^\[wam\]\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const CQE_FIRST_LINE_RE = /^(?:cqe:|\[wam cqe)/i;
const FILE_TOKEN_RE = /(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z][A-Za-z0-9]{0,7}|[A-Za-z0-9_.-]+\.[A-Za-z][A-Za-z0-9]{0,7}/g;

function cqeFileKey(text) {
  const raw = String(text || "").trim();
  if (!CQE_FIRST_LINE_RE.test(raw)) return null;
  const files = [...raw.matchAll(FILE_TOKEN_RE)].map((m) => m[0]);
  return `cqe:${[...new Set(files)].sort().join(",")}`;
}

export function hashContextBlock(text) {
  const key = cqeFileKey(text) ?? normalizeContextText(text);
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function loadInjected(root, sessionID) {
  try {
    return JSON.parse(fs.readFileSync(injectedPath(root, sessionID), "utf8")) || {};
  } catch {
    return {};
  }
}

function saveInjected(root, sessionID, store) {
  const file = injectedPath(root, sessionID);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

export function isCriticalContext(text) {
  return CRITICAL_RE.test(String(text || ""));
}

/**
 * @param {string[]} items
 * @param {{ root?: string, sessionID?: string, ttlMs?: number, now?: number }} [opts]
 */
export function filterNewContext(items, opts = {}) {
  const root = opts.root || process.cwd();
  const sessionID = opts.sessionID || "default";
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const now = opts.now ?? Date.now();
  const store = loadInjected(root, sessionID);

  for (const [key, ts] of Object.entries(store)) {
    if (!ts || now - ts > ttlMs) delete store[key];
  }

  const kept = [];
  for (const item of items || []) {
    const text = typeof item === "string" ? item : item?.text || "";
    if (!text.trim()) continue;
    if (isCriticalContext(text)) {
      kept.push(item);
      continue;
    }
    const key = hashContextBlock(text);
    if (store[key]) continue;
    store[key] = now;
    kept.push(item);
  }

  const entries = Object.entries(store)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ENTRIES);
  saveInjected(root, sessionID, Object.fromEntries(entries));
  return kept;
}
