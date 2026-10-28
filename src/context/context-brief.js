/**
 * Structured context brief for OpenCode compaction.
 *
 * Keeps the contract/evidence/decision model instead of a generic transcript
 * summary. Bounded by maxChars.
 */

import { buildSemanticProjection, renderSemanticProjection } from "./semantic-projection.js";
import { loadExecutionLedger } from "../state/execution-ledger.js";
import { getApplicableConstraints } from "../state/task-hierarchy.js";

const MAX_DEFAULT = 4000;

function truncate(text, max = 160) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

// Structured sources only; any failure degrades to the legacy brief.
function resolveProjection({ taskId, taskState, decisions, root, ledger, base, constraints }) {
  try {
    const loaded = ledger || (root ? loadExecutionLedger(root, taskId) : null);
    const hasLedger = Boolean(loaded && Object.keys(loaded.requirements || {}).length > 0);
    if (!hasLedger && !base) return null;
    const resolvedConstraints =
      Array.isArray(constraints) && constraints.length
        ? constraints
        : root
          ? getApplicableConstraints(root, taskId)
          : [];
    return buildSemanticProjection({
      taskId,
      taskState,
      decisions,
      ledger: hasLedger ? loaded : null,
      base: base || null,
      constraints: resolvedConstraints,
    });
  } catch {
    return null;
  }
}

export function buildContextBrief({
  taskId = "unknown",
  taskState = {},
  decisions = [],
  entities = [],
  maxChars = MAX_DEFAULT,
  root = null,
  ledger = null,
  base = null,
  constraints = [],
  projectionMode = "active",
} = {}) {
  const contract = taskState.contract || {};
  const requirements = taskState.requirements || [];
  const projection =
    projectionMode === "legacy"
      ? null
      : resolveProjection({ taskId, taskState, decisions, root, ledger, base, constraints });
  const open = requirements.filter((r) => r.status !== "done" && r.status !== "verified");
  const verified = requirements.filter((r) => r.status === "verified");
  const objective =
    contract.objective ||
    taskState.currentGoal ||
    requirements[0]?.title ||
    taskState.lastAction ||
    "unknown";

  const lines = [
    "[wam context brief]",
    `task: ${taskId} — ${taskState.phase || "?"} / ${contract.status || "?"}`,
  ];
  if (!projection) lines.push(`objective: ${truncate(objective, 220)}`);
  lines.push(`requirements: ${open.length} open / ${requirements.length} total`);

  for (const req of open.slice(0, 10)) {
    lines.push(`- open ${req.id || "?"}: ${truncate(req.title, 140)} (${req.status || "pending"})`);
  }
  for (const req of verified.slice(0, 6)) {
    lines.push(`- verified ${req.id || "?"}: ${truncate(req.title, 120)}`);
  }

  const contractConstraints = contract.constraints || [];
  if (!projection && contractConstraints.length) {
    lines.push("constraints:");
    for (const c of contractConstraints.slice(0, 6)) lines.push(`- ${truncate(c, 140)}`);
  }
  const nonGoals = contract.nonGoals || [];
  if (nonGoals.length) {
    lines.push("non-goals:");
    for (const c of nonGoals.slice(0, 6)) lines.push(`- ${truncate(c, 140)}`);
  }

  if (!projection && decisions.length) {
    lines.push("decisions:");
    for (const d of decisions.slice(0, 8)) {
      const text = typeof d === "string" ? d : d.decision || d.text || "";
      lines.push(`- ${truncate(text, 160)}`);
    }
  }

  if (entities.length) {
    lines.push("entities:");
    for (const e of entities.slice(0, 12)) {
      const value = typeof e === "string" ? e : `${e.kind || "ref"}=${e.value || ""}`;
      lines.push(`- ${truncate(value, 180)}`);
    }
  }

  const blocking = (contract.unknowns || []).filter((u) => u.status === "blocking");
  if (blocking.length) {
    lines.push("blocking questions:");
    for (const u of blocking.slice(0, 5)) lines.push(`- ${u.id || "?"}: ${truncate(u.question, 160)}`);
  }

  if (projection) {
    lines.push(...renderSemanticProjection(projection, { maxChars, truncate }).split("\n"));
  }

  const text = lines.join("\n").slice(0, maxChars);
  const fallbackReason = projection
    ? null
    : projectionMode === "legacy"
      ? "legacy-mode"
      : "no-ledger-and-no-base";
  return {
    text,
    tokens: estimateTokens(text),
    sections: lines.length,
    budgetChars: maxChars,
    projection,
    fallbackReason,
  };
}
