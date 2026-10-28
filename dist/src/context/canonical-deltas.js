/**
 * Canonical Deltas — versioned base snapshot + propose/validate/accept flow.
 *
 * The canonical project base is never mutated in place: proposals are staged,
 * validated and only then applied as a new base version.
 */
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { atomicWrite } from "../state/state-store.js";
import { wamStateDir } from "../shared/wam-paths.js";
import {
  buildCanonicalProjectContext,
  loadCanonicalProjectContext,
  renderCanonicalProjectContext,
  validateCanonicalProjectContext,
} from "./canonical-project-context.js";

const ENTRY_KINDS = ["fact", "assumption"];
const OP_TYPES = ["add", "update", "invalidate"];
const PROPOSAL_STATUSES = ["proposed", "accepted", "rejected"];

export function canonicalDir(root) {
  return join(wamStateDir(root), "canonical");
}

export function basePath(root) {
  return join(canonicalDir(root), "base.json");
}

export function proposalsPath(root) {
  return join(canonicalDir(root), "proposals.json");
}

function nowIso() {
  return new Date().toISOString();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw new Error(`corrupt canonical state: ${file}: ${error.message}`);
  }
}

function seedBase(root) {
  const { doc, source } = loadCanonicalProjectContext(root);
  const cpc = buildCanonicalProjectContext({ doc, source });
  return {
    version: 0,
    entries: cpc.entries.map((entry, index) => ({
      id: `cpc-${index + 1}`,
      kind: entry.kind,
      text: entry.text,
      section: entry.section,
      source: entry.source,
      status: "active",
    })),
    createdAt: nowIso(),
    previousVersion: null,
  };
}

/**
 * Loads the base snapshot. When absent, pins a version 0 snapshot seeded from
 * the current CPC so later CPC edits cannot silently mutate the canonical base.
 */
export async function loadBase(root) {
  const file = basePath(root);
  try {
    const base = await readJson(file, null);
    if (base) return base;
  } catch (error) {
    if (!/ENOENT/.test(error.message)) throw error;
  }
  const seeded = seedBase(root);
  await atomicWrite(file, seeded);
  return seeded;
}

async function loadProposals(root) {
  return readJson(proposalsPath(root), []);
}

async function saveProposals(root, proposals) {
  await mkdir(dirname(proposalsPath(root)), { recursive: true });
  await atomicWrite(proposalsPath(root), proposals);
}

function entryShapeErrors(entry, label) {
  const errors = [];
  if (!entry || typeof entry !== "object") return [`${label} must be an object`];
  if (!ENTRY_KINDS.includes(entry.kind)) {
    errors.push(`${label}.kind must be one of ${ENTRY_KINDS.join("|")}`);
  }
  if (typeof entry.text !== "string" || !entry.text.trim()) {
    errors.push(`${label}.text must be a non-empty string`);
  }
  if (entry.section != null && typeof entry.section !== "string") {
    errors.push(`${label}.section must be a string`);
  }
  if (entry.source != null && typeof entry.source !== "string") {
    errors.push(`${label}.source must be a string`);
  }
  return errors;
}

/**
 * Applies ops to a copy. Returns errors instead of throwing so callers can
 * validate without touching disk.
 */
function applyOps(entries, proposal) {
  const errors = [];
  const next = entries.map((entry) => ({ ...entry }));
  const ops = Array.isArray(proposal?.ops) ? proposal.ops : [];

  for (const [index, op] of ops.entries()) {
    const label = `ops[${index}]`;
    if (!op || typeof op !== "object" || !OP_TYPES.includes(op.op)) {
      errors.push(`${label}.op must be one of ${OP_TYPES.join("|")}`);
      continue;
    }

    if (op.op === "add") {
      errors.push(...entryShapeErrors(op.entry, `${label}.entry`));
      if (op.entry?.id && next.some((entry) => entry.id === op.entry.id)) {
        errors.push(`${label}.entry.id already exists: ${op.entry.id}`);
      }
      if (op.entry && typeof op.entry === "object") {
        next.push({
          id: op.entry.id,
          kind: op.entry.kind,
          text: op.entry.text,
          section: op.entry.section ?? "proposal",
          source: op.entry.source ?? "proposed",
          status: "active",
        });
      }
      continue;
    }

    if (typeof op.entryId !== "string" || !op.entryId) {
      errors.push(`${label}.entryId must be a non-empty string`);
      continue;
    }
    const target = next.find((entry) => entry.id === op.entryId);
    if (!target) {
      errors.push(`${label}.entryId not found: ${op.entryId}`);
      continue;
    }
    if (target.status !== "active") {
      errors.push(`${label}.entryId is not active: ${op.entryId}`);
      continue;
    }

    if (op.op === "update") {
      errors.push(...entryShapeErrors({ ...target, ...op.entry }, `${label}.entry`));
      next[next.indexOf(target)] = {
        ...target,
        ...op.entry,
        id: target.id,
        status: "active",
      };
      continue;
    }

    next[next.indexOf(target)] = {
      ...target,
      status: "invalidated",
      invalidatedBy: proposal.id,
      invalidatedAt: nowIso(),
    };
  }

  return { ok: errors.length === 0, errors, entries: next };
}

/** Validates a proposal against a freshly loaded base; never throws. */
function validateProposal(proposal, base) {
  if (!proposal) return ["proposal not found"];
  const errors = [];
  if (!PROPOSAL_STATUSES.includes(proposal.status)) {
    errors.push(`invalid proposal status: ${proposal.status}`);
  }
  if (proposal.status !== "proposed") {
    errors.push(`proposal is already ${proposal.status}`);
  }
  if (proposal.baseVersion !== base.version) {
    errors.push(`baseVersion mismatch: proposal=${proposal.baseVersion} base=${base.version}`);
  }
  if (!Array.isArray(proposal.ops) || proposal.ops.length === 0) {
    errors.push("ops must be a non-empty array");
    return errors;
  }

  const applied = applyOps(base.entries, proposal);
  errors.push(...applied.errors);
  if (applied.ok) {
    // Budget is a render concern; only contamination/kind rejections matter here.
    const cpcCheck = validateCanonicalProjectContext({ entries: applied.entries });
    errors.push(...cpcCheck.errors.filter((error) => !error.startsWith("token budget")));
  }
  return errors;
}

export async function proposeDelta(root, ops, { reason = "", sourceRefs = [] } = {}) {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new TypeError("ops must be a non-empty array");
  }
  if (!Array.isArray(sourceRefs) || sourceRefs.some((ref) => typeof ref !== "string")) {
    throw new TypeError("sourceRefs must be an array of strings");
  }

  const base = await loadBase(root);
  const proposals = await loadProposals(root);
  const normalized = ops.map((op) => {
    if (op?.op === "add" && op.entry && !op.entry.id) {
      return { ...op, entry: { ...op.entry, id: `e-${randomUUID()}` } };
    }
    return op;
  });
  const proposal = {
    id: `p-${randomUUID()}`,
    createdAt: nowIso(),
    status: "proposed",
    baseVersion: base.version,
    reason,
    sourceRefs,
    ops: normalized,
  };
  proposals.push(proposal);
  await saveProposals(root, proposals);
  return proposal;
}

/** Validates without throwing and without writing anything. */
export async function validateDelta(root, proposalId) {
  try {
    const [base, proposals] = await Promise.all([loadBase(root), loadProposals(root)]);
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) return { ok: false, errors: ["proposal not found"] };
    const errors = validateProposal(proposal, base);
    return { ok: errors.length === 0, errors };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

/**
 * Accepts a proposal into a new base version. Re-reads the base immediately
 * before applying to detect concurrent writes (optimistic concurrency).
 */
export async function acceptDelta(root, proposalId, { decision = "" } = {}) {
  const proposals = await loadProposals(root);
  const index = proposals.findIndex((item) => item.id === proposalId);
  if (index === -1) return { ok: false, errors: ["proposal not found"] };

  // Fresh read right before apply; a stale baseVersion fails without writing.
  const base = await loadBase(root);
  const proposal = proposals[index];
  const errors = validateProposal(proposal, base);
  if (errors.length) return { ok: false, errors };

  const applied = applyOps(base.entries, proposal);
  if (!applied.ok) return { ok: false, errors: applied.errors };

  const nextBase = {
    version: base.version + 1,
    entries: applied.entries,
    createdAt: nowIso(),
    previousVersion: base.version,
  };
  // Base first: a crash here leaves the proposal "proposed" and the old
  // proposal's baseVersion stale, so a retry fails safely (no double apply).
  await mkdir(dirname(basePath(root)), { recursive: true });
  await atomicWrite(basePath(root), nextBase);
  proposals[index] = {
    ...proposal,
    status: "accepted",
    decidedAt: nowIso(),
    decision,
  };
  await saveProposals(root, proposals);
  return { ok: true, base: nextBase, proposal: proposals[index] };
}

export async function rejectDelta(root, proposalId, { decision = "" } = {}) {
  const proposals = await loadProposals(root);
  const index = proposals.findIndex((item) => item.id === proposalId);
  if (index === -1) return { ok: false, errors: ["proposal not found"] };
  if (proposals[index].status !== "proposed") {
    return { ok: false, errors: [`proposal is already ${proposals[index].status}`] };
  }
  proposals[index] = {
    ...proposals[index],
    status: "rejected",
    decidedAt: nowIso(),
    decision,
  };
  await saveProposals(root, proposals);
  return { ok: true, proposal: proposals[index] };
}

export async function listDeltas(root) {
  return loadProposals(root);
}

/** Renders the active entries only; never writes to the CPC memo. */
export async function materializeBase(root) {
  const base = await loadBase(root);
  return renderCanonicalProjectContext({
    entries: base.entries.filter((entry) => entry.status === "active"),
  });
}
