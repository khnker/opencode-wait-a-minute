/**
 * Production writer for the per-task execution ledger.
 *
 * The ledger itself is event-sourced (see execution-ledger.js). This module is
 * the only production seam that turns task-state transitions into ledger
 * events, so compaction can project structured state instead of the transcript.
 */

import fs from "node:fs";
import { createEvent, WAM_EVENTS } from "../shared/wam-events.js";
import {
  applyEvents,
  executionLedgerPath,
  loadExecutionLedger,
  saveExecutionLedger,
} from "./execution-ledger.js";

const STATUS_TARGETS = Object.freeze({
  done: "SUPPORTED",
  verified: "VERIFIED",
  pending: "OPEN",
});

const NEXT_EVENT = Object.freeze({
  OPEN: WAM_EVENTS.ACTION_STARTED,
  IN_PROGRESS: WAM_EVENTS.OBSERVATION_CREATED,
  UNKNOWN: WAM_EVENTS.OBSERVATION_CREATED,
  OBSERVED: WAM_EVENTS.EVIDENCE_ADDED,
  SUPPORTED: WAM_EVENTS.VERIFICATION_COMPLETED,
});

const MAX_STEPS = 6;

function claimOf(requirement) {
  return String(requirement?.title || requirement?.claim || requirement?.id || "").trim();
}

function evidenceRef(evidence, requirementId) {
  const value = String(evidence || "").replace(/\s+/g, " ").trim();
  return value ? value.slice(0, 180) : requirementId;
}

function nextEvent(current, target, { taskId, requirementId, evidence }) {
  if (current === "VERIFIED" && target === "OPEN") {
    return createEvent(WAM_EVENTS.VERIFICATION_COMPLETED, {
      taskId,
      requirementId,
      status: "OPEN",
    });
  }
  const type = NEXT_EVENT[current];
  if (!type) return null;
  if (type === WAM_EVENTS.VERIFICATION_COMPLETED) {
    return createEvent(type, { taskId, requirementId, status: target });
  }
  if (type === WAM_EVENTS.EVIDENCE_ADDED) {
    return createEvent(type, { taskId, requirementId, ref: evidenceRef(evidence, requirementId) });
  }
  return createEvent(type, { taskId, requirementId, summary: `requirement -> ${target.toLowerCase()}` });
}

/** Record one `CLAIM_CREATED` event per requirement missing from the ledger. */
export function seedRequirements(root, taskId, requirements = []) {
  const ledger = loadExecutionLedger(root, taskId);
  const events = (Array.isArray(requirements) ? requirements : [])
    .filter((requirement) => requirement?.id && !ledger.requirements[requirement.id])
    .map((requirement) =>
      createEvent(WAM_EVENTS.CLAIM_CREATED, {
        taskId,
        requirementId: requirement.id,
        claim: claimOf(requirement) || requirement.id,
      }),
    );
  if (!events.length) return ledger;
  const next = applyEvents(ledger, events);
  saveExecutionLedger(root, next);
  return next;
}

/** Advance the ledger up to the status reported by the task state. */
export function recordRequirementStatus(root, taskId, { requirementId, status, evidence } = {}) {
  const target = STATUS_TARGETS[status];
  if (!requirementId || !target) return loadExecutionLedger(root, taskId);

  let ledger = loadExecutionLedger(root, taskId);
  let current = ledger.requirements[requirementId]?.status;
  if (!current) {
    ledger = applyEvents(ledger, [
      createEvent(WAM_EVENTS.CLAIM_CREATED, { taskId, requirementId, claim: requirementId }),
    ]);
    current = ledger.requirements[requirementId]?.status;
  }

  let changed = false;
  for (let step = 0; step < MAX_STEPS && current !== target; step += 1) {
    const event = nextEvent(current, target, { taskId, requirementId, evidence });
    if (!event) break;
    const next = applyEvents(ledger, [event]);
    const nextStatus = next.requirements[requirementId]?.status;
    if (nextStatus === current) break;
    ledger = next;
    current = nextStatus;
    changed = true;
  }

  if (changed) saveExecutionLedger(root, ledger);
  return ledger;
}

/** Drop the ledger when the contract requirements are replaced. */
export function resetExecutionLedger(root, taskId) {
  const file = executionLedgerPath(root, taskId);
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}
