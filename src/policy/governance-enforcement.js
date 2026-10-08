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
 *   - Delegated workers (sessions with a resolved parentID) are exempt. An
 *     unresolved session is NOT a subagent — see isSubagent detection in
 *     index.js to keep that contract.
 *   - An explicit, audited override disables enforcement (WAM_GOVERNANCE=off).
 *   - A PROPOSED/DRAFT contract with no pending requirements fails OPEN so the
 *     first write of a fresh task is never bricked.
 *   - Files under /tmp or other non-repo paths are treated as ephemeral and
 *     are NOT classified as protected paths, even if their basename matches a
 *     protected pattern.
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

/** Non-repo / ephemeral path prefixes that should not be subject to
 *  protected-path rules. Governance is about the project repo, not the user's
 *  temp dir. */
const NON_REPO_PATH_PREFIXES = [
  "/tmp/",
  "/private/tmp/",
  "/var/folders/",
  process.env.TMPDIR ? process.env.TMPDIR + "/" : "",
  process.env.TEMP ? process.env.TEMP + "/" : "",
  process.env.TMP ? process.env.TMP + "/" : "",
].filter(Boolean);

/** True when the path is outside any tracked repository and is ephemeral in
 *  nature. Used to short-circuit protected-path checks so that, e.g., a
 *  scratch file at /tmp/foo/package.json doesn't trigger governance. */
export function isNonRepoPath(file) {
  if (!file) return false;
  const f = String(file);
  return NON_REPO_PATH_PREFIXES.some((p) => p && f.startsWith(p));
}

export function isGovernanceDisabled() {
  const v = String(process.env.WAM_GOVERNANCE || "").toLowerCase();
  return v === "off" || v === "0" || process.env.WAM_BYPASS === "1";
}

export function isTerminalPhase(phase) {
  return TERMINAL_PHASES.has(String(phase || "").toUpperCase());
}

export function isProtectedPath(file) {
  const f = String(file || "");
  if (!f) return false;
  // Non-repo / ephemeral paths (e.g. /tmp scratch files) are never "protected":
  // governance rules are about the project repo, not the user's temp dir.
  if (isNonRepoPath(f)) return false;
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
 * @param {boolean} [ctx.isSubagent] - true when the caller is a delegated worker
 *   (i.e. the session has a resolved parentID). An unresolved session is NOT
 *   a subagent.
 * @param {string[]} [ctx.declaredFiles] - files the current task is scoped to.
 * @returns {{allowed: boolean, reason: string}}
 * @throws {WamPolicyBlock}
 */
export function enforceGovernance(tool, state, ctx = {}) {
  if (!CONTRACT_GATED_TOOLS.has(tool)) return { allowed: true, reason: "tool-not-gated" };

  // Hard config switch (cfg.enforcement === false): governance is fully off.
  if (ctx.enforcementEnabled === false) {
    logDecision({ decision: "allow", reason: "config-disabled", tool, phase: state?.phase });
    return { allowed: true, reason: "config-disabled" };
  }

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

  // Nothing to approve: a tracked contract in a non-approved state with no
  // pending requirements and no unknowns has no work to gate. Denying here is
  // a fail-closed deadlock (the block message even reports "0 requisito(s)
  // pendiente(s)"). Fail open, like an untracked session, so the first write
  // of a fresh task is never bricked.
  //
  // Note: previously this required `declared.length === 0` too, which combined
  // with the contract file-derivation in index.js meant every edit (which
  // always declares its own target file) would deadlock on a fresh PROPOSED
  // contract. The new rule is: pending === 0 AND unknowns.length === 0 → no
  // work to gate, regardless of declared files.
  const unknowns = state?.contract?.unknowns || state?.unknowns || [];
  if (pending === 0 && unknowns.length === 0) {
    logDecision({ decision: "allow", reason: "empty-contract", tool, phase });
    return { allowed: true, reason: "empty-contract" };
  }

  // Hard fail-open: a PROPOSED/DRAFT contract with zero pending requirements,
  // zero declared files AND no blocking unknowns has no contract body to
  // approve. Never block. (The unknowns check keeps blocking unknowns
  // effective — see "empty-contract fix: a blocking unknown still gates an
  // otherwise empty contract" test.)
  const declared = Array.isArray(ctx.declaredFiles) ? ctx.declaredFiles : [];
  if (pending === 0 && declared.length === 0 && unknowns.length === 0) {
    logDecision({ decision: "allow", reason: "proposed-no-work", tool, phase });
    return { allowed: true, reason: "proposed-no-work" };
  }

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
