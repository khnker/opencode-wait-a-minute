import path from "node:path";
import { discoverSkills } from "../policy/skill-routing.js";
import { buildRegistry } from "../skills/engine.js";
import { getRoleDefinition } from "./role-contracts.js";

const APPROVED_STATUSES = new Set(["APPROVED", "AVAILABLE", "LOADED"]);
const DEFAULT_MAX_TOTAL_CHARS = 22000;
const DEFAULT_MAX_SKILL_CHARS = 10000;
const CACHE_TTL_MS = 30000;
const registryCache = new Map();

function registryFor(root) {
  const key = path.resolve(root || process.cwd());
  const cached = registryCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.registry;
  const available = discoverSkills({ root: key });
  const registry = buildRegistry(available, key).registry;
  registryCache.set(key, { at: Date.now(), registry });
  return registry;
}

export function resolveRoleSkills(role, {
  root = process.cwd(),
  registry = null,
  maxTotalChars = DEFAULT_MAX_TOTAL_CHARS,
  maxSkillChars = DEFAULT_MAX_SKILL_CHARS,
} = {}) {
  const definition = getRoleDefinition(role);
  const preferred = Array.isArray(definition.skills) ? definition.skills : [];
  if (preferred.length === 0) {
    return { skills: [], documents: [], missing: [], text: "" };
  }

  const source = registry || registryFor(root);
  const documents = [];
  const missing = [];
  let used = 0;

  for (const id of preferred) {
    const skill = source[id];
    if (!skill || !APPROVED_STATUSES.has(skill.status)) {
      missing.push(id);
      continue;
    }
    const content = typeof skill.content === "string" ? skill.content.trim() : "";
    if (!content) {
      missing.push(id);
      continue;
    }
    const clipped = content.slice(0, maxSkillChars);
    if (used + clipped.length > maxTotalChars) break;
    documents.push({ id, content: clipped });
    used += clipped.length;
  }

  const text = documents.length === 0
    ? ""
    : [
      "Loaded WAM role skills (apply them as operating guidance):",
      ...documents.map((skill) => `\n### ${skill.id}\n${skill.content}`),
    ].join("\n");

  return {
    skills: documents.map((skill) => skill.id),
    documents,
    missing,
    text,
  };
}

export function clearRoleSkillCache() {
  registryCache.clear();
}
