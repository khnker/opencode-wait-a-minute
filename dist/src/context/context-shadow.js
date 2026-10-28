/**
 * Shadow context projection: measures the semantic projection without injecting it.
 *
 * Pure computation (mode resolution + record building) plus one bounded,
 * fail-soft JSONL append. Telemetry must never influence compaction output.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export const PROJECTION_MODES = Object.freeze(["legacy", "shadow", "active"]);

const DEFAULT_MODE = "active";
const FILE_NAME = "context-shadow.jsonl";
const MAX_BYTES = 1_000_000;
const MAX_LINES = 500;

export function resolveProjectionMode(value, { onInvalid } = {}) {
  const mode = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (PROJECTION_MODES.includes(mode)) return mode;
  if (mode) {
    try {
      onInvalid?.(value);
    } catch {
      // a diagnostic hook must never break config resolution
    }
  }
  return DEFAULT_MODE;
}

function hashText(text) {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function buildShadowRecord({
  now = () => new Date().toISOString(),
  schemaVersion = 1,
  sessionId = null,
  taskId = "unknown",
  mode = "shadow",
  budgetChars = 0,
  injectedText = "",
  shadowText = "",
  projection = null,
  fallbackReason = null,
  taskState = {},
  decisions = [],
} = {}) {
  const injected = String(injectedText || "");
  const shadow = String(shadowText || "");
  const injectedHash = hashText(injected);
  const shadowHash = hashText(shadow);

  // Real projections nest execution state under projection.execution; only
  // constraints and retrievableRefs stay top-level.
  const execution = projection?.execution || {};
  const included = Array.isArray(execution.requirements) ? execution.requirements : [];
  const includedIds = included.map((req) => req?.id).filter(Boolean);
  const includedSet = new Set(includedIds);
  // Projections expose no omitted-requirement list: derive it from the caller's task state.
  const omittedIds = (Array.isArray(taskState.requirements) ? taskState.requirements : [])
    .map((req) => req?.id)
    .filter((id) => id && !includedSet.has(id));

  const liveDecisions = Array.isArray(projection?.decisions) ? projection.decisions.length : 0;
  const totalDecisions = Array.isArray(decisions) ? decisions.length : 0;

  return {
    schemaVersion,
    timestamp: now(),
    sessionId,
    taskId,
    mode,
    budgetChars,
    injectedChars: injected.length,
    shadowChars: shadow.length,
    injectedHash,
    shadowHash,
    injectedTokenEstimate: estimateTokens(injected),
    shadowTokenEstimate: estimateTokens(shadow),
    deltaChars: shadow.length - injected.length,
    requirements: {
      included: includedIds,
      omitted: omittedIds,
      pending: Array.isArray(execution.pending) ? execution.pending.length : 0,
      conflicts: Array.isArray(execution.conflicts) ? execution.conflicts.length : 0,
    },
    decisions: {
      live: liveDecisions,
      dropped: Math.max(0, totalDecisions - liveDecisions),
    },
    constraints: Array.isArray(projection?.constraints) ? projection.constraints.length : 0,
    retrievableRefs: Array.isArray(projection?.retrievableRefs) ? projection.retrievableRefs.length : 0,
    projectionAvailable: projection != null,
    fallbackReason: projection ? null : fallbackReason || "projection-unavailable",
    equivalent: injectedHash === shadowHash,
  };
}

export function shadowRecordPath(root) {
  const base = process.env.WAM_METRICS_DIR || path.join(root || process.cwd(), ".wam");
  return path.join(base, FILE_NAME);
}

// Fail-soft: returns false on any I/O error, never throws into compaction.
export function appendShadowRecord(root, record) {
  try {
    const file = shadowRecordPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
    const { size } = fs.statSync(file);
    if (size > MAX_BYTES) {
      const kept = fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .slice(-MAX_LINES);
      fs.writeFileSync(file, `${kept.join("\n")}\n`, "utf8");
    }
    return true;
  } catch {
    return false;
  }
}
