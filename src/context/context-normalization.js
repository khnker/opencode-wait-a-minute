/**
 * Context Normalization — unify all captured context into ContextItem.
 *
 * Every raw capture record (tool_call, agent_message, file_modification,
 * git_change, requirement_change, verification_result) is normalized
 * into a canonical ContextItem:
 *   { id, content, source, type, timestamp, scope, relatedRequirements[], metadata,
 *     kind, status, retention, sourceRefs[], relations[], scopeType, scopeId }
 */

import { classifyContextItem } from "./context-classification.js";
import { normalizeScope } from "./context-scope.js";

export const CONTEXT_KINDS = Object.freeze([
  "FACT", "OBSERVATION", "CLAIM", "ASSUMPTION", "DECISION",
  "REQUIREMENT", "EVIDENCE", "ERROR", "ACTION", "RESULT",
]);

export const CONTEXT_SCOPE_TYPES = Object.freeze(["project", "group", "task", "session"]);

export const CONTEXT_STATUSES = Object.freeze([
  "proposed", "accepted", "rejected", "active", "superseded", "invalidated",
]);

export const RETENTION_POLICIES = Object.freeze([
  "active", "durable", "archivable", "ephemeral",
]);

export const RELATION_TYPES = Object.freeze([
  "derived_from", "supports", "contradicts", "supersedes", "depends_on",
]);

// Existing SCOPES collapse onto the four persisted scope types; GLOBAL has no
// persisted counterpart and maps to the broadest durable bucket.
const SCOPE_TYPE_BY_SCOPE = Object.freeze({
  PROJECT: "project",
  GLOBAL: "project",
  TASK: "task",
  REQUIREMENT: "task",
  ACTION: "task",
  SESSION: "session",
  TURN: "session",
});

const RETENTION_BY_KIND = Object.freeze({
  FACT: "durable",
  OBSERVATION: "archivable",
  CLAIM: "archivable",
  ASSUMPTION: "archivable",
  DECISION: "durable",
  REQUIREMENT: "durable",
  EVIDENCE: "durable",
  ERROR: "active",
  ACTION: "active",
  RESULT: "active",
});

/**
 * @typedef {Object} ContextItem
 * @property {string} id - Unique identifier
 * @property {string} content - Human-readable content / summary
 * @property {string} source - Where the context originated
 * @property {string} type - Category (tool_call, agent_message, etc.)
 * @property {number} timestamp - Unix ms
 * @property {string} scope - Scope boundary (session, requirement, task, project)
 * @property {string[]} relatedRequirements - Related requirement IDs
 * @property {Object} metadata - Extra metadata
 */

/**
 * Normalize a single raw capture record into a ContextItem.
 * @param {Object} record - Raw capture record
 * @returns {ContextItem}
 */
export function normalizeContextItem(record) {
  if (!record || typeof record !== "object") {
    throw new TypeError("Record must be a non-null object");
  }
  if (!record.id || !record.type) {
    throw new TypeError("Record must have id and type");
  }

  const content = extractContent(record);
  const relatedRequirements = extractRelatedRequirements(record);
  const kind = normalizeKind(record, content);
  const { scopeType, scopeId } = normalizeScopeFields(record);

  return {
    id: record.id,
    content,
    source: record.source || "unknown",
    type: record.type,
    timestamp: record.timestamp || Date.now(),
    scope: record.scope || "session",
    relatedRequirements,
    metadata: record.metadata || {},
    kind,
    status: CONTEXT_STATUSES.includes(record.status) ? record.status : "active",
    retention: RETENTION_POLICIES.includes(record.retention)
      ? record.retention
      : RETENTION_BY_KIND[kind] || "active",
    sourceRefs: normalizeStringArray(record.sourceRefs),
    relations: normalizeRelations(record.relations),
    scopeType,
    scopeId,
  };
}

export const normalizeItem = normalizeContextItem;

/**
 * Normalize an array of raw records into ContextItems.
 * @param {Object[]} records
 * @returns {ContextItem[]}
 */
export function normalizeContextItems(records) {
  if (!Array.isArray(records)) {
    throw new TypeError("Records must be an array");
  }
  return records.map(normalizeContextItem);
}

function extractContent(record) {
  const { type, content } = record;

  // Agent messages: content is { role, content }
  if (type === "agent_message" && content && typeof content === "object") {
    return `[${content.role}] ${content.content || ""}`;
  }

  // Tool calls / results: content is { toolName, params } or { toolName, result }
  if ((type === "tool_call" || type === "tool_result") && content && typeof content === "object") {
    const name = content.toolName || "unknown";
    if (type === "tool_call") {
      const paramsStr = content.params ? JSON.stringify(content.params).slice(0, 200) : "";
      return `Tool call: ${name}(${paramsStr})`;
    }
    const resultStr = typeof content.result === "string" ? content.result.slice(0, 200) : "[non-string result]";
    return `Tool result: ${name} → ${resultStr}`;
  }

  // File modifications: { filePath, action, details }
  if (type === "file_modification" && content && typeof content === "object") {
    return `File ${content.action}: ${content.filePath}${content.details ? ` — ${JSON.stringify(content.details).slice(0, 150)}` : ""}`;
  }

  // Git changes: { action, details }
  if (type === "git_change" && content && typeof content === "object") {
    const hash = content.details?.hash ? ` (${content.details.hash.slice(0, 8)})` : "";
    const msg = content.details?.message || "";
    return `Git ${content.action}${hash}: ${msg}`;
  }

  // Requirement changes: { action, requirement }
  if (type === "requirement_change" && content && typeof content === "object") {
    const req = content.requirement || {};
    return `Requirement ${content.action}: ${req.id || "?"} — ${req.title || req.description || ""}`;
  }

  // Verification results: { status, details }
  if (type === "verification_result" && content && typeof content === "object") {
    const test = content.details?.testName || content.details?.assertion || "";
    return `Verification ${content.status}: ${test}`;
  }

  // Fallback
  if (typeof content === "string") return content;
  if (content && typeof content === "object") return JSON.stringify(content).slice(0, 500);
  return String(record.content ?? "");
}

function extractRelatedRequirements(record) {
  const reqs = [];

  // Check metadata
  if (record.metadata?.requirementId) {
    reqs.push(record.metadata.requirementId);
  }
  if (record.metadata?.requirementIds) {
    reqs.push(...record.metadata.requirementIds);
  }

  // Check content fields
  if (record.content && typeof record.content === "object") {
    const req = record.content.requirement;
    if (req?.id) reqs.push(req.id);
    if (record.content.requirementId) reqs.push(record.content.requirementId);
  }

  return [...new Set(reqs)];
}

function normalizeKind(record, content) {
  if (CONTEXT_KINDS.includes(record.kind)) return record.kind;
  if (CONTEXT_KINDS.includes(record.metadata?.kind)) return record.metadata.kind;

  const classified = classifyContextItem({
    type: record.type,
    content: typeof content === "string" ? content : JSON.stringify(content ?? ""),
    metadata: record.metadata || {},
  });
  return CONTEXT_KINDS.includes(classified?.category) ? classified.category : "FACT";
}

function normalizeScopeFields(record) {
  const explicit = record.scope && typeof record.scope === "object" ? record.scope : null;
  const scopeType = CONTEXT_SCOPE_TYPES.includes(explicit?.type)
    ? explicit.type
    : CONTEXT_SCOPE_TYPES.includes(record.scopeType)
      ? record.scopeType
      : SCOPE_TYPE_BY_SCOPE[normalizeScope(record.scope)] || "session";
  const scopeId = [
    explicit?.id,
    record.scopeId,
    record.metadata?.scopeId,
    record.metadata?.projectId,
    record.metadata?.groupId,
    record.metadata?.taskId,
    record.metadata?.sessionId,
    record.id,
  ].find((v) => typeof v === "string" && v.trim());

  return { scopeType, scopeId: scopeId ? scopeId.trim() : "unknown" };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const ref = entry.trim();
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

function normalizeRelations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const relation of value) {
    if (!relation || typeof relation !== "object") continue;
    if (!RELATION_TYPES.includes(relation.type)) continue;
    if (typeof relation.targetId !== "string" || !relation.targetId.trim()) continue;
    const targetId = relation.targetId.trim();
    const key = `${relation.type}:${targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: relation.type, targetId });
  }
  return out;
}

/**
 * Validate a ContextItem without throwing; errors are reported, not raised.
 * @param {Object} item
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateContextItem(item) {
  const errors = [];
  if (!item || typeof item !== "object") {
    return { ok: false, errors: ["item must be a non-null object"] };
  }

  if (typeof item.id !== "string" || !item.id.trim()) {
    errors.push("id must be a non-empty string");
  }
  if (!CONTEXT_KINDS.includes(item.kind)) {
    errors.push(`kind must be one of ${CONTEXT_KINDS.join("|")}`);
  }
  if (!CONTEXT_STATUSES.includes(item.status)) {
    errors.push(`status must be one of ${CONTEXT_STATUSES.join("|")}`);
  }
  if (!RETENTION_POLICIES.includes(item.retention)) {
    errors.push(`retention must be one of ${RETENTION_POLICIES.join("|")}`);
  }

  const scope = item.scope && typeof item.scope === "object" ? item.scope : null;
  const scopeType = scope?.type ?? item.scopeType;
  const scopeId = scope?.id ?? item.scopeId;
  if (!CONTEXT_SCOPE_TYPES.includes(scopeType)) {
    errors.push(`scope.type must be one of ${CONTEXT_SCOPE_TYPES.join("|")}`);
  }
  if (typeof scopeId !== "string" || !scopeId.trim()) {
    errors.push("scope.id must be a non-empty string");
  }

  if (!Array.isArray(item.sourceRefs) ||
      item.sourceRefs.some((ref) => typeof ref !== "string" || !ref.trim())) {
    errors.push("sourceRefs must be an array of non-empty strings");
  }

  if (!Array.isArray(item.relations)) {
    errors.push("relations must be an array");
  } else {
    for (const relation of item.relations) {
      if (!relation || typeof relation !== "object" ||
          !RELATION_TYPES.includes(relation.type) ||
          typeof relation.targetId !== "string" || !relation.targetId.trim()) {
        errors.push("relations entries must be { type: one of " +
          `${RELATION_TYPES.join("|")}, targetId: non-empty string }`);
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
