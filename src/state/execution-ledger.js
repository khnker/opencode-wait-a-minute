/**
 * Execution Ledger — per-task event-sourced view of requirement progress.
 *
 * The ledger only changes through events. There is deliberately no API that
 * accepts a free-text summary, so compaction can never rewrite execution state.
 */

import fs from "node:fs";
import path from "node:path";
import { taskDir } from "../shared/wam-paths.js";
import { WAM_EVENTS } from "../shared/wam-events.js";
import {
  REQUIREMENT_STATES,
  VALID_TRANSITIONS,
  canTransition,
} from "../verification/verification-model.js";

const LEDGER_FILE = "execution-ledger.json";
const LEDGER_VERSION = 1;

const REQUIREMENT_EVENTS = new Set([
  WAM_EVENTS.CLAIM_CREATED,
  WAM_EVENTS.REQUIREMENT_CREATED,
  WAM_EVENTS.ACTION_STARTED,
  WAM_EVENTS.ACTION_COMPLETED,
  WAM_EVENTS.OBSERVATION_CREATED,
  WAM_EVENTS.EVIDENCE_ADDED,
  WAM_EVENTS.EVIDENCE_CONFLICT,
  WAM_EVENTS.VERIFICATION_STARTED,
  WAM_EVENTS.VERIFICATION_COMPLETED,
  WAM_EVENTS.COMPLETION_BLOCKED,
]);

export function executionLedgerPath(root, taskId) {
  return path.join(taskDir(root, taskId), LEDGER_FILE);
}

export function emptyExecutionLedger(taskId) {
  return {
    version: LEDGER_VERSION,
    taskId: String(taskId),
    requirements: {},
    processedEventIds: [],
    ignoredEvents: 0,
    updatedAt: null,
  };
}

export function loadExecutionLedger(root, taskId) {
  const file = executionLedgerPath(root, taskId);
  if (!fs.existsSync(file)) return emptyExecutionLedger(taskId);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    throw new Error(`Corrupt execution ledger at ${file}: ${err.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Corrupt execution ledger at ${file}: expected an object`);
  }
  return {
    version: parsed.version ?? LEDGER_VERSION,
    taskId: String(parsed.taskId ?? taskId),
    requirements: parsed.requirements ?? {},
    processedEventIds: parsed.processedEventIds ?? [],
    ignoredEvents: parsed.ignoredEvents ?? 0,
    updatedAt: parsed.updatedAt ?? null,
  };
}

export function saveExecutionLedger(root, ledger) {
  const file = executionLedgerPath(root, ledger.taskId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2));
  fs.renameSync(tmp, file);
  return file;
}

/**
 * Pure: returns a new ledger, never mutates `ledger` or `events`.
 */
export function applyEvents(ledger, events) {
  const next = structuredClone(ledger);
  next.requirements = next.requirements || {};
  next.processedEventIds = next.processedEventIds || [];
  next.ignoredEvents = next.ignoredEvents || 0;

  const processed = new Set(next.processedEventIds);
  const list = Array.isArray(events) ? events : [];

  for (const raw of list) {
    const event = normalizeEvent(raw, next.taskId);
    if (!event) {
      next.ignoredEvents += 1;
      continue;
    }
    if (processed.has(event.id)) continue; // idempotent replay

    if (!REQUIREMENT_EVENTS.has(event.type)) {
      next.ignoredEvents += 1;
      continue;
    }

    const requirementId = event.requirementId;
    if (!requirementId) {
      next.ignoredEvents += 1;
      continue;
    }

    if (event.type === WAM_EVENTS.CLAIM_CREATED || event.type === WAM_EVENTS.REQUIREMENT_CREATED) {
      const claim = typeof event.data.claim === "string" ? event.data.claim : "";
      if (!claim) {
        next.ignoredEvents += 1;
        continue;
      }
      const existing = next.requirements[requirementId];
      next.requirements[requirementId] = existing
        ? { ...existing, claim }
        : newRequirement(requirementId, claim, event.at);
      processed.add(event.id);
      next.processedEventIds.push(event.id);
      continue;
    }

    const requirement = next.requirements[requirementId];
    if (!requirement) {
      next.ignoredEvents += 1;
      continue;
    }

    applyRequirementEvent(requirement, event);
    processed.add(event.id);
    next.processedEventIds.push(event.id);
  }

  next.updatedAt = next.processedEventIds.length > 0 ? Date.now() : next.updatedAt;
  return next;
}

function newRequirement(id, claim, at) {
  return {
    id,
    claim,
    status: REQUIREMENT_STATES.OPEN,
    actions: [],
    observations: [],
    evidence: [],
    decisions: [],
    obligations: [],
    createdAt: at ?? null,
  };
}

function applyRequirementEvent(requirement, event) {
  const { type, data, at, id } = event;

  if (type === WAM_EVENTS.ACTION_STARTED || type === WAM_EVENTS.ACTION_COMPLETED) {
    requirement.actions.push(record(id, at, data));
    if (type === WAM_EVENTS.ACTION_STARTED) {
      transition(requirement, REQUIREMENT_STATES.IN_PROGRESS);
    }
    return;
  }

  if (type === WAM_EVENTS.OBSERVATION_CREATED) {
    requirement.observations.push(record(id, at, data));
    transition(requirement, REQUIREMENT_STATES.OBSERVED);
    return;
  }

  if (type === WAM_EVENTS.EVIDENCE_ADDED) {
    const conflict = data.conflict === true || data.contradicts === true;
    requirement.evidence.push({
      eventId: id,
      at,
      ref: data.ref ?? data.evidenceId ?? id,
      kind: conflict ? "conflict" : "support",
      note: data.note ?? null,
    });
    if (!conflict) transition(requirement, REQUIREMENT_STATES.SUPPORTED);
    return;
  }

  if (type === WAM_EVENTS.EVIDENCE_CONFLICT) {
    requirement.evidence.push({
      eventId: id,
      at,
      ref: data.ref ?? data.evidenceId ?? id,
      kind: "conflict",
      note: data.reason ?? data.note ?? null,
    });
    return;
  }

  if (type === WAM_EVENTS.VERIFICATION_STARTED) {
    requirement.decisions.push({ eventId: id, at, decision: "verification-started", note: data.note ?? null });
    return;
  }

  if (type === WAM_EVENTS.VERIFICATION_COMPLETED) {
    if (hasOpenConflict(requirement)) {
      requirement.decisions.push({ eventId: id, at, decision: "verification-blocked-by-conflict" });
      return;
    }
    const requested = data.status;
    const target =
      requested && Object.values(REQUIREMENT_STATES).includes(requested)
        ? requested
        : REQUIREMENT_STATES.VERIFIED;
    if (!transition(requirement, target)) {
      requirement.decisions.push({ eventId: id, at, decision: "verification-rejected", to: target });
    }
    return;
  }

  if (type === WAM_EVENTS.COMPLETION_BLOCKED) {
    requirement.obligations.push({ eventId: id, at, reason: data.reason ?? "completion blocked" });
    return;
  }
}

function transition(requirement, to) {
  if (requirement.status === to) return true;
  if (!canTransition(requirement.status, to)) return false;
  requirement.status = to;
  return true;
}

function hasOpenConflict(requirement) {
  return requirement.evidence.some((item) => item.kind === "conflict");
}

function record(eventId, at, data) {
  return { eventId, at, summary: data.summary ?? data.description ?? null, ref: data.ref ?? null };
}

function normalizeEvent(raw, ledgerTaskId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || raw.id.length === 0) return null;
  if (typeof raw.type !== "string" || raw.type.length === 0) return null;

  const at = typeof raw.at === "number" ? raw.at : raw.timestamp;
  if (typeof at !== "number") return null;

  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : {};
  const declaredTaskId = raw.taskId ?? data.taskId ?? ledgerTaskId;
  if (String(declaredTaskId) !== String(ledgerTaskId)) return null;

  const requirementId = raw.requirementId ?? data.requirementId ?? data.id;
  return {
    id: raw.id,
    type: raw.type,
    at,
    data,
    requirementId: typeof requirementId === "string" ? requirementId : null,
  };
}

/**
 * Deterministic projection: sorted requirements, obligations and conflicts.
 */
export function projectExecution(ledger) {
  const requirements = Object.values(ledger.requirements || {})
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((req) => {
      const openObligations = obligationsFor(req);
      return {
        id: req.id,
        claim: req.claim,
        status: req.status,
        evidenceRefs: req.evidence
          .map((item) => item.ref)
          .filter((ref) => typeof ref === "string")
          .sort(),
        openObligations,
      };
    });

  const pendingObligations = requirements
    .flatMap((req) => req.openObligations.map((item) => ({ requirementId: req.id, ...item })))
    .sort((a, b) => String(a.requirementId).localeCompare(String(b.requirementId)));

  const conflicts = Object.values(ledger.requirements || {})
    .flatMap((req) =>
      req.evidence
        .filter((item) => item.kind === "conflict")
        .map((item) => ({
          requirementId: req.id,
          eventId: item.eventId,
          ref: item.ref,
          note: item.note ?? null,
        })),
    )
    .sort((a, b) => String(a.requirementId).localeCompare(String(b.requirementId)));

  return { taskId: ledger.taskId, requirements, pendingObligations, conflicts };
}

function obligationsFor(requirement) {
  if (requirement.status === REQUIREMENT_STATES.VERIFIED) return [];
  const nextStates = (VALID_TRANSITIONS[requirement.status] || []).slice().sort();
  const blocked = hasOpenConflict(requirement);
  return [
    {
      status: requirement.status,
      reason: blocked ? "unresolved evidence conflict" : "not verified",
      nextStates,
    },
  ];
}
