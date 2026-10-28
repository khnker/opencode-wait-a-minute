/**
 * Retention Policy — dependency-aware retention planning for ContextItems.
 *
 * Pure planner: it classifies items into keep/archive/discard, but never
 * mutates its input and never touches disk. Callers (a later projection phase)
 * decide when and how to apply the plan.
 *
 * Retention semantics (owned by context-normalization):
 *   active/durable → keep
 *   archivable     → archive (recoverable) unless referenced by a live item
 *   ephemeral      → discard only when unreferenced and not load-bearing
 */
import { RETENTION_POLICIES, RELATION_TYPES } from "./context-normalization.js";

const LIVE_POLICIES = new Set(["active", "durable"]);
const ARCHIVABLE = "archivable";
const EPHEMERAL = "ephemeral";
const CLAIM_KINDS = new Set(["CLAIM", "REQUIREMENT"]);
const EVIDENCE_KIND = "EVIDENCE";
const DEAD_CLAIM_STATUSES = new Set(["invalidated", "superseded"]);
const SUPPORT_RELATION_TYPES = RELATION_TYPES.filter((type) =>
  /support|justif|evidence|prove/i.test(type),
);

function retentionOf(item) {
  const retention = String(item?.retention ?? "").toLowerCase();
  // Fail safe: an unknown policy must never silently drop context.
  return RETENTION_POLICIES.includes(retention) ? retention : "unknown";
}

function kindOf(item) {
  return String(item?.kind ?? "").toUpperCase();
}

function isLive(item) {
  return LIVE_POLICIES.has(retentionOf(item));
}

function isClaim(item) {
  return CLAIM_KINDS.has(kindOf(item));
}

function isEvidence(item) {
  return kindOf(item) === EVIDENCE_KIND;
}

function isDeadClaim(item) {
  return DEAD_CLAIM_STATUSES.has(String(item?.status ?? "").toLowerCase());
}

function isSupportRelation(type) {
  return SUPPORT_RELATION_TYPES.includes(type) || /support|justif|evidence|prove/i.test(type);
}

function isBackReference(type) {
  return /supported[_-]?by|justified[_-]?by|evidence[_-]?for/i.test(type);
}

/**
 * Build a one-pass, cycle-safe reference index from item.relations.
 * No traversal and no recursion: a relation cycle is just data here.
 */
export function buildReferenceIndex(items = []) {
  const list = Array.isArray(items) ? items : [];
  const referencedBy = new Map();
  const relationsOf = new Map();

  for (const item of list) {
    if (!item || typeof item.id !== "string") continue;
    const relations = Array.isArray(item.relations) ? item.relations : [];
    relationsOf.set(item.id, relations.map((relation) => ({ ...relation })));

    for (const relation of relations) {
      if (!relation || typeof relation !== "object") continue;
      if (typeof relation.targetId !== "string" || !relation.targetId.trim()) continue;
      if (typeof relation.type !== "string" || !relation.type.trim()) continue;
      const incoming = referencedBy.get(relation.targetId) || [];
      incoming.push({ id: item.id, relation: relation.type });
      referencedBy.set(relation.targetId, incoming);
    }
  }

  return { referencedBy, relationsOf };
}

function buildSupportMap(list, byId) {
  const supportedBy = new Map(); // claimId -> Set(evidenceId)

  const link = (claimId, evidenceId) => {
    if (!byId.has(claimId) || !byId.has(evidenceId)) return;
    const claim = byId.get(claimId);
    const evidence = byId.get(evidenceId);
    if (!isClaim(claim) || !isEvidence(evidence)) return;
    const evidenceIds = supportedBy.get(claimId) || new Set();
    evidenceIds.add(evidenceId);
    supportedBy.set(claimId, evidenceIds);
  };

  for (const item of list) {
    if (!item || typeof item.id !== "string") continue;
    const relations = Array.isArray(item.relations) ? item.relations : [];
    for (const relation of relations) {
      if (!relation || typeof relation.type !== "string") continue;
      if (isSupportRelation(relation.type)) link(relation.targetId, item.id);
      // Claims may also point back at their evidence.
      if (isBackReference(relation.type)) link(item.id, relation.targetId);
    }
  }

  return supportedBy;
}

function isReferencedByLive(id, referencedBy, byId) {
  const references = referencedBy.get(id) || [];
  return references.some(({ id: sourceId }) => {
    const source = byId.get(sourceId);
    return source ? isLive(source) : false;
  });
}

function soleJustificationClaim(id, supportedBy, byId) {
  for (const [claimId, evidenceIds] of supportedBy) {
    if (!evidenceIds.has(id)) continue;
    const claim = byId.get(claimId);
    if (!claim || isDeadClaim(claim)) continue;
    if (evidenceIds.size === 1) return claimId;
  }
  return null;
}

function ephemeralBlockReason(item, { referencedBy, byId, supportedBy, canDiscard }) {
  if (!canDiscard(item)) return "canDiscard veto";
  if (isReferencedByLive(item.id, referencedBy, byId)) {
    return "referenced by a live item";
  }
  const claimId = soleJustificationClaim(item.id, supportedBy, byId);
  if (claimId) return `sole justification for live claim ${claimId}`;
  return null;
}

/**
 * Plan retention deterministically. Returns item ids, not items.
 *
 * @param {Array} items
 * @param {{ now?: number, canDiscard?: (item: Object) => boolean }} [options]
 * @returns {{ keep: string[], archive: string[], discard: string[], blocked: {id: string, reason: string}[] }}
 */
export function planRetention(items = [], options = {}) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map();
  for (const item of list) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }

  const { referencedBy } = buildReferenceIndex(list);
  const supportedBy = buildSupportMap(list, byId);
  const canDiscard = typeof options.canDiscard === "function" ? options.canDiscard : () => true;

  const keep = [];
  const archive = [];
  const discard = [];
  const blocked = [];

  for (const item of list) {
    if (!item || typeof item.id !== "string") continue;
    const retention = retentionOf(item);

    if (retention === "active" || retention === "durable") {
      keep.push(item.id);
      continue;
    }

    if (retention === ARCHIVABLE) {
      // Never discard: archive unless a live item still points at it.
      if (isReferencedByLive(item.id, referencedBy, byId)) keep.push(item.id);
      else archive.push(item.id);
      continue;
    }

    if (retention === EPHEMERAL) {
      const reason = ephemeralBlockReason(item, { referencedBy, byId, supportedBy, canDiscard });
      if (reason) {
        keep.push(item.id);
        blocked.push({ id: item.id, reason });
      } else {
        discard.push(item.id);
      }
      continue;
    }

    // Unknown retention policy: retain rather than lose context.
    keep.push(item.id);
  }

  const byIdOrder = (a, b) => String(a).localeCompare(String(b));
  keep.sort(byIdOrder);
  archive.sort(byIdOrder);
  discard.sort(byIdOrder);
  blocked.sort((a, b) => byIdOrder(a.id, b.id));

  return { keep, archive, discard, blocked };
}

/**
 * Materialize a plan without mutating the source items. Archived entries are
 * the original objects, so their sourceRefs remain available for recovery.
 */
export function applyRetentionPlan(items = [], plan = {}) {
  const byId = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (item && typeof item.id === "string") byId.set(item.id, item);
  }

  const pick = (ids) =>
    (Array.isArray(ids) ? ids : [])
      .map((id) => byId.get(id))
      .filter((item) => item !== undefined);

  return {
    kept: pick(plan.keep),
    archived: pick(plan.archive),
    discarded: pick(plan.discard),
  };
}
