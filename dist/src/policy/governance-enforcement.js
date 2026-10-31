/**
 * Governance Enforcement — Centralized policy check for tool execution.
 *
 * Returns a decision object; an unapproved contract yields an advisory
 * recommendation, never a block. Invariants:
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

import { logger } from "../integration/logger.js";

/** Tools gated by contract approval. Deliberately narrower than the risk
 *  engine's MUTATING_TOOLS (which also covers bash/task). */
export const CONTRACT_GATED_TOOLS = new Set([
  "write", "edit", "apply_patch", "patch", "todo_write", "todowrite",
]);

export const DELEGATION_GATED_TOOLS = new Set(["read", "grep", "glob", "list"]);

export function enforceReadDelegation(tool, ctx = {}) {
  const mode = process.env.WAM_READ_DELEGATION || "off";
  if (mode === "off") {
    return { allowed: true, reason: "read-delegation-off" };
  }
  if (ctx.enforcementEnabled === false) {
    return { allowed: true, reason: "config-disabled" };
  }
  if (ctx.isSubagent) {
    return { allowed: true, reason: "subagent" };
  }
  if (!DELEGATION_GATED_TOOLS.has(tool)) {
    return { allowed: true, reason: "tool-not-delegation-gated" };
  }
  return {
    allowed: false,
    reason: "delegate-to-fast",
    directive: `[wait-a-minute] READ DELEGATION (${tool}): delegá la exploración read-only al subagente @fast (Task subagent_type=fast) en vez de ejecutarla en la sesión principal.`,
  };
}

/**
 * Scratch-script guard — prevents ad-hoc throwaway test/debug scripts
 * (test_tipo.js, debug_full.js, scratch-*.mjs, etc.) when a real unit
 * test already exists for the same module.
 *
 * The agent should extend the existing test file, not spawn a temp script.
 * Returns null when no restriction applies; otherwise a decision object.
 */
// Matches ad-hoc scratch scripts: test_<anything>, debug_<anything>,
// scratch-*, _tmp_*, repro-*, and similar. Deliberately broad: the point
// is to catch the common "I'll just write a quick script to verify" pattern.
const SCRATCH_NAME_RE = /^(test_|debug_|scratch-|_tmp_|repro_|quick-|tmp-|_debug_|_test_|diagnose_|investigate_)/i;
const SCRATCH_DIR_RE = /(^|[\\/])(tmp|scratch|_scratch|diagnostics?)([\\/]|$)/i;

export function enforceNoScratchScripts(tool, args, { taskRoot, existingTests = [] } = {}) {
  if (tool !== "write" && tool !== "edit" && tool !== "apply_patch" && tool !== "patch") {
    return null;
  }
  const targetPath = args?.filePath || args?.path || args?.file;
  if (!targetPath || typeof targetPath !== "string") return null;

  // Only restrict paths that look like scratch: /tmp, scratch dirs, or
  // ad-hoc names. Real repo test files (tests/unit/*.test.mjs) are fine.
  const isTmp = NON_REPO_PATH_PREFIXES.some((p) => p && targetPath.startsWith(p));
  const inScratchDir = SCRATCH_DIR_RE.test(targetPath);
  const isScratchName = SCRATCH_NAME_RE.test(targetPath.split(/[\\/]/).pop() || "");
  if (!isTmp && !inScratchDir && !isScratchName) return null;

  // If a real test file exists in the repo for the same area, redirect.
  // Normalize hyphens/underscores so "test_loop_budget.js" matches
  // "loop-budget-guard.test.mjs" — the separator is cosmetic.
  const basename = targetPath.split(/[\\/]/).pop() || "";
  const stem = basename
    .replace(/^test_|^debug_|^scratch-|^_tmp_|^repro_|^quick-|^tmp-|^diagnose_|^investigate_/i, "")
    .replace(/\.(js|mjs)$/i, "")
    .replace(/[-_]/g, "");
  const match = existingTests.find((t) => {
    const tBase = (t.split(/[\\/]/).pop() || "")
      .replace(/\.(mjs|js)$/i, "")
      .replace(/\.test$/i, "")
      .replace(/[-_]/g, "");
    return tBase.includes(stem) || (stem.length > 0 && stem.includes(tBase));
  });

  // A scratch script is always blocked (allowed=false). The distinction is
  // whether we can redirect the agent to an existing test file (match) or
  // must give a generic nudge (no match). Both are BLOCKED; neither permits
  // the write.
  return {
    allowed: false,
    reason: match ? "existing-test-found" : "scratch-script",
    directive: match
      ? `[wait-a-minute] Script temporal detectado (${basename}). En su lugar, extendé el test existente ${match} (usá el mismo framework) en lugar de crear un script ad-hoc.`
      : `[wait-a-minute] Script temporal detectado (${basename}). Evitá scripts basura en /tmp o con nombres ad-hoc; usá los tests unitarios existentes del repo.`,
  };
}

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
  const unknowns = state?.contract?.unknowns || state?.unknowns || [];

  if (pending === 0 && unknowns.length === 0) {
    logDecision({ decision: "allow", reason: "empty-contract", tool, phase });
    return { allowed: true, reason: "empty-contract" };
  }

  // Si no hay requisitos pendientes, permitimos cambios sencillos y directos sin requerir aprobación explícita de contrato.
  if (pending === 0 && (!ctx.declaredFiles || ctx.declaredFiles.length === 0) && unknowns.length === 0) {
    logDecision({ decision: "allow", reason: "simple-direct-change", tool, phase });
    return { allowed: true, reason: "simple-direct-change" };
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
    `[wait-a-minute] contrato no aprobado (fase ${phase || "?"}). ` +
    `${pending} requisito(s) pendiente(s). ` +
    `Recomendación: revisá el contrato con /wam contract approve; procedo igualmente.`;

  logDecision({ decision: "advisory", tool, phase, contractStatus, files: ctx.declaredFiles || [] });
  return { allowed: true, reason: "advisory", recommendation: directive };
}
