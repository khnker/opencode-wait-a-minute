import { EVIDENCE_STRENGTH } from "../evidence/evidence.js";

const STRENGTH_RANK = Object.freeze({
  L0_CLAIM: 0,
  L1_INFERENCE: 1,
  L2_OBSERVATION: 2,
  L3_DIRECT: 3,
  L4_VERIFICATION: 4,
});

const STALE_STATUSES = new Set([
  "STALE",
  "EXPIRED",
  "INVALIDATED",
  "stale",
  "expired",
  "invalidated",
]);

function isOptional(requirement) {
  return requirement?.optional === true || requirement?.required === false;
}

function verifiedStatus(requirement) {
  return requirement?.status === "verified" || requirement?.verificationStatus === "VERIFIED";
}

function evidenceItems(requirement) {
  return Array.isArray(requirement?.evidence) ? requirement.evidence : [];
}

function sessionIdOf(value) {
  return value?.sessionId || value?.sessionID || null;
}

function timestampOf(value) {
  if (!value?.timestamp) return null;
  const time = new Date(value.timestamp).getTime();
  return Number.isFinite(time) ? time : null;
}

function structured(evidence) {
  return evidence.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.sessionId !== undefined ||
        item.sessionID !== undefined ||
        item.timestamp !== undefined ||
        item.createdAt !== undefined ||
        item.strength !== undefined ||
        item.supports !== undefined ||
        item.stale !== undefined ||
        item.status !== undefined),
  );
}

function evidenceProblems(requirement, state, options) {
  const items = evidenceItems(requirement);
  const structuredItems = structured(items);
  if (structuredItems.length === 0) return [];

  const problems = [];
  const taskSession = sessionIdOf(state);

  for (const item of structuredItems) {
    const evidenceSession = sessionIdOf(item);
    if (taskSession && evidenceSession && taskSession !== evidenceSession) {
      problems.push("cross-session evidence");
      break;
    }
  }

  const maxAgeMs = Number.isFinite(options?.maxAgeMs) && options.maxAgeMs > 0
    ? options.maxAgeMs
    : null;
  const now = Number.isFinite(options?.now) ? options.now : Date.now();

  for (const item of structuredItems) {
    if (item.stale === true || STALE_STATUSES.has(item.status)) {
      problems.push("stale evidence");
      break;
    }
    if (maxAgeMs) {
      const at = timestampOf(item);
      if (at !== null && now - at > maxAgeMs) {
        problems.push("expired evidence");
        break;
      }
    }
  }

  const supports = structuredItems.filter((item) => item.supports === true);
  const contradicts = structuredItems.filter((item) => item.supports === false);
  if (supports.length > 0 && contradicts.length > 0) {
    problems.push("contradictory evidence");
  }

  const ranked = structuredItems
    .map((item) => STRENGTH_RANK[item.strength])
    .filter((rank) => Number.isFinite(rank));
  if (ranked.length > 0) {
    const required = requirement?.critical === true
      ? STRENGTH_RANK[EVIDENCE_STRENGTH.L3_DIRECT]
      : STRENGTH_RANK[EVIDENCE_STRENGTH.L2_OBSERVATION];
    if (Math.max(...ranked) < required) {
      problems.push(
        requirement?.critical === true
          ? "insufficient evidence strength (direct evidence required)"
          : "insufficient evidence strength (observation required)",
      );
    }
  }

  return problems;
}

/**
 * Checks the invariants that can be derived from persisted task state.
 * PURE: no I/O, no mutation. Returns the same pending-item shape as the
 * completion gate so callers can merge or replace their own checks.
 *
 * @param {object} state
 * @param {{ now?: number, maxAgeMs?: number }} [options]
 * @returns {{ ok: boolean, pending: string[], verifying?: boolean }}
 */
export function evaluateCompletionInvariants(state, options = {}) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return {
      ok: false,
      pending: ["Invalid task state - completion not verified"],
    };
  }

  const pending = [];
  let verifying = false;

  const unknowns = Array.isArray(state.contract?.unknowns) ? state.contract.unknowns : [];
  const blockingUnknowns = unknowns.filter(
    (unknown) => unknown?.status === "blocking",
  );
  for (const unknown of blockingUnknowns) {
    pending.push(`${unknown.id} - ${unknown.question} (DECISION_CRITICAL sin responder)`);
  }

  const assumptions = Array.isArray(state.contract?.assumptions) ? state.contract.assumptions : [];
  const blockingAssumptions = assumptions.filter(
    (assumption) =>
      assumption?.classification === "DECISION_CRITICAL" &&
      assumption?.status !== "resolved",
  );
  for (const assumption of blockingAssumptions) {
    pending.push(`${assumption.id} - ${assumption.statement} (DECISION_CRITICAL sin resolver)`);
  }

  if (state.requirements !== undefined && !Array.isArray(state.requirements)) {
    return {
      ok: false,
      pending: [...pending, "Invalid requirements state - completion not verified"],
    };
  }

  const requirements = Array.isArray(state.requirements) ? state.requirements : [];
  for (const requirement of requirements.filter((item) => !isOptional(item))) {
    const id = requirement?.id || "(sin id)";
    const title = requirement?.title || requirement?.claim || "requisito";
    const evidence = evidenceItems(requirement);
    const status = requirement?.status;

    if (!verifiedStatus(requirement)) {
      if ((status === "done" || status === "verified") && evidence.length === 0) {
        pending.push(`${id} — ${title} (sin evidencia)`);
      } else if (status === "done" || status === "verified") {
        pending.push(`${id} — ${title} (verificar: /wam progress ${id} verified <evidencia>)`);
      } else {
        pending.push(`${id} — ${title}`);
      }
      verifying = true;
      continue;
    }
    if (evidence.length === 0) {
      pending.push(`${id} — ${title} (sin evidencia)`);
      verifying = true;
      continue;
    }

    for (const problem of evidenceProblems(requirement, state, options)) {
      pending.push(`${id} - ${title} (${problem})`);
      verifying = true;
    }
  }

  const backlog = Array.isArray(state.backlog) ? state.backlog : [];
  for (const item of backlog.filter((entry) => entry?.status === "pending")) {
    pending.push(`${item.id || "(sin id)"} - ${item.title || item.description || "backlog"} (backlog pendiente)`);
  }

  return {
    ok: pending.length === 0,
    pending,
    ...(verifying ? { verifying: true } : {}),
  };
}
