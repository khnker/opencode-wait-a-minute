import fs from "node:fs";
import path from "node:path";
import { DIALOGUE_INTENTS, normalizeObservation } from "./observation.js";
import { stateSignature } from "./dialogue-state.js";

const MAX_ROOTS = 10;
const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_CACHE_CONFIDENCE = 0.7;
const shared = new Map();

export function normalizeMessage(message) {
  return String(message ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function dictionaryKey(message, taskState, dialogueState) {
  const signature = stateSignature(taskState, dialogueState);
  return `${normalizeMessage(message)}|${signature}`;
}

function cloneEntry(entry) {
  return {
    observation: normalizeObservation(entry.observation),
    hits: Number(entry.hits) || 0,
    createdAt: Number(entry.createdAt) || Date.now(),
    lastUsed: Number(entry.lastUsed) || Date.now(),
    source: entry.source || "unknown",
  };
}

export function createIntentDictionary({
  maxEntries = DEFAULT_MAX_ENTRIES,
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) {
  const entries = new Map();

  function touch(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    entries.delete(key);
    entries.set(key, entry);
    entry.hits += 1;
    entry.lastUsed = now();
    return entry;
  }

  function prune() {
    const cutoff = now() - ttlMs;
    for (const [key, entry] of entries) {
      if (entry.lastUsed < cutoff) entries.delete(key);
    }
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return {
    get(message, taskState, dialogueState) {
      const key = dictionaryKey(message, taskState, dialogueState);
      const entry = touch(key);
      if (!entry) return null;
      if (entry.lastUsed < now() - ttlMs) {
        entries.delete(key);
        return null;
      }
      return {
        ...entry.observation,
        source: "dictionary",
        confidence: entry.observation.confidence,
      };
    },
    set(message, taskState, dialogueState, observation, { source = "heuristic" } = {}) {
      const normalized = normalizeObservation(observation);
      if (
        normalized.intent === DIALOGUE_INTENTS.UNKNOWN ||
        normalized.confidence < MIN_CACHE_CONFIDENCE
      ) {
        return false;
      }
      const key = dictionaryKey(message, taskState, dialogueState);
      entries.set(key, {
        observation: normalized,
        hits: entries.get(key)?.hits || 0,
        createdAt: entries.get(key)?.createdAt || now(),
        lastUsed: now(),
        source,
      });
      prune();
      return true;
    },
    size() {
      prune();
      return entries.size;
    },
    toJSON() {
      return {
        version: 1,
        entries: Object.fromEntries(entries),
      };
    },
    load(data) {
      entries.clear();
      const source = data?.entries && typeof data.entries === "object" ? data.entries : {};
      for (const [key, raw] of Object.entries(source)) {
        if (!raw || typeof raw !== "object") continue;
        const obs = normalizeObservation(raw.observation);
        if (obs.intent === DIALOGUE_INTENTS.UNKNOWN) continue;
        entries.set(key, cloneEntry({ ...raw, observation: obs }));
      }
      prune();
    },
  };
}

export function dictionaryPath(root) {
  return path.join(root, ".wam", "dialogue", "intent-dictionary.json");
}

export function loadIntentDictionary(root) {
  const dict = createIntentDictionary();
  try {
    const file = dictionaryPath(root);
    if (fs.existsSync(file)) {
      dict.load(JSON.parse(fs.readFileSync(file, "utf8")));
    }
  } catch {
    // Corrupt cache is a diagnostic, never a blocker.
  }
  return dict;
}

export function saveIntentDictionary(root, dict) {
  try {
    const file = dictionaryPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(dict.toJSON(), null, 2));
    fs.renameSync(tmp, file);
  } catch {
    // Best-effort cache.
  }
}

export function getIntentDictionary(root) {
  if (!root) return createIntentDictionary();
  if (!shared.has(root)) {
    if (shared.size >= MAX_ROOTS) {
      shared.delete(shared.keys().next().value);
    }
    shared.set(root, loadIntentDictionary(root));
  }
  return shared.get(root);
}

export function clearIntentDictionaryCache() {
  shared.clear();
}
