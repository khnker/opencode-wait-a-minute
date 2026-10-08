/**
 * Governance Enforcement — Centralized policy check for tool execution.
 *
 * Returns a decision object, or throws WamPolicyBlock when governance is
 * violated. Invariants:
 *   - Only CONTRACT_GATED_TOOLS are ever blocked; `bash`/`task` (investigation
 *     and delegation surfaces) stay usable so tests can run and workers can be
 *     dispatched.
 *   - A session with no tracked task/contract fails OPEN: there is nothing to
 *     approve, and default-deny here deadlocked every write/edit.
 *   - Delegated workers (sessions with a parentID) are exempt.
 *   - An explicit, audited override disables enforcement (WAM_GOVERNANCE=off).
 */

import { WamPolicyBlock } from "./risk-engine.js";
import { logger } from "../integration/logger.js";

/** Tools gated by contract approval. Deliberately narrower than the risk
 *  engine's MUTATING_TOOLS (which also covers bash/task). */
export const CONTRACT_GATED_TOOLS = new Set([
  "write", "edit", "apply_patch", "patch", "todo_write", "todowrite",
]);

/** Phases from which no further mutation gate applies. */
export const TERMINAL_PHASES = new Set(["COMPLETE", "DONE"]);

const TRIVIAL_MAX_FILES = Number.parseInt(process.env.WAM_TRIVIAL_MAX_FILES || "2", 10);

/** Paths that always require an approved contract regardless of file count. */
const PROTECTED_SEGMENT_RE = /(^|[\\/])(\.github|migrations?|deploy|\.env)([\\/]|$)/i;
const PROTECTED_BASENAME_RE = /(^|[\\/])(ci\.ya?ml|package\.json|package-lock\.json|tsconfig[^\\/]*\.json)$/i;

export function isGovernanceDisabled() {
  const v = String(process.env.WAM_GOVERNANCE || "").toLowerCase();
  return v === "off" || v === "0" || process.env.WAM_BYPASS === "1";
}

export function isTerminalPhase(phase) {
  return TERMINAL_PHASES.has(phase);
}

export function isProtectedPath(file) {
  const f = String(file || "");
  return PROTECTED_SEGMENT_RE.test(f) || PROTECTED_BASENAME_RE.test(f);
}

export function isTrivialChange(declaredFiles) {
  if (!Array.isArray(declaredFiles) || declaredFiles.length === 0) return false;
  if (declaredFiles.length > TRIVIAL_MAX_FILES) return false;
  return declaredFiles.every((f) => !isProtectedPath(f));
}

function logDecision(event) {
  try {
    logger.info("governance", JSON.stringify(event));
  } catch {
    /* logging must never break enforcement */
  }
}

/**
 * @param {string} tool
 * @param {object|null} state - task state ({ phase, contract, requirements }).
 * @param {object} [ctx]
 * @param {boolean} [ctx.isSubagent] - true when the caller is a delegated worker.
 * @param {string[]} [ctx.declaredFiles] - files the current task is scoped to.
 * @returns {{allowed: boolean, reason: string}}
 * @throws {WamPolicyBlock}
 */
export function enforceGovernance(tool, state, ctx = {}) {
  if (!CONTRACT_GATED_TOOLS.has(tool)) return { allowed: true, reason: "tool-not-gated" };

  if (isGovernanceDisabled()) {
    logDecision({ decision: "allow", reason: "override", tool, phase: state?.phase });
    return { allowed: true, reason: "override" };
  }

  if (ctx.isSubagent) {
    logDecision({ decision: "allow", reason: "subagent", tool, phase: state?.phase });
    return { allowed: true, reason: "subagent" };
  }

  // No tracked task/contract: nothing to approve → fail open (never deadlock
  // ad-hoc/untracked sessions before a contract can exist).
  if (!state) {
    logDecision({ decision: "allow", reason: "untracked", tool });
    return { allowed: true, reason: "untracked" };
  }

  const contractStatus = state?.contract?.status;
  const phase = state?.phase;

  if (contractStatus === "APPROVED") return { allowed: true, reason: "contract-approved" };
  if (isTerminalPhase(phase)) return { allowed: true, reason: "terminal-phase" };
  // Let the Clarification Gate handle ASKING (answer the unknown, don't approve).
  if (phase === "ASKING") return { allowed: true, reason: "defer-asking" };
  if (isTrivialChange(ctx.declaredFiles)) {
    logDecision({ decision: "allow", reason: "trivial", tool, files: ctx.declaredFiles });
    return { allowed: true, reason: "trivial" };
  }

  const pending = (state.requirements || state.contract?.requirements || [])
    .filter((r) => r.status !== "done" && r.status !== "verified").length;

  const directive =
    `[wait-a-minute] GOVERNANCE BLOCK (${tool}): contrato no aprobado ` +
    `(fase ${phase || "?"}). ${pending} requisito(s) pendiente(s). ` +
    `Aprobá el contrato (/wam contract approve) o pasá el token de aprobación en el Task. ` +
    `Si sos subagente, ESCALATE al orquestador — no explores buscando un camino alternativo.`;

  logDecision({ decision: "deny", tool, phase, contractStatus, files: ctx.declaredFiles || [] });
  throw new WamPolicyBlock(directive, {
    tool,
    reason: "contract-not-approved",
    level: "BLOCKED",
    source: "governance-enforcement",
  });
}
