
import fs from "node:fs";
import path from "node:path";
import { logger } from "../integration/logger.js";
import { createAuditCoalescer } from "../persistence/audit-coalescer.js";

/**
 * ContextDecisionTracer
 *
 * Handles audit logging for context decision processes.
 * Ensures persistence to .wam/traces/<trace_id>.json with fail-safe behavior.
 */
export class ContextDecisionTracer {
  constructor(traceId, projectRoot, mode = "standard") {
    this.traceId = traceId;
    // Validate projectRoot: must exist and be a directory; otherwise fallback to cwd.
    const rootCandidates = [projectRoot, process.cwd()];
    let validRoot = process.cwd();
    for (const candidate of rootCandidates) {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        validRoot = candidate;
        break;
      }
    }
    if (validRoot !== (projectRoot || process.cwd())) {
      logger.warn("ContextDecisionTracer", `Invalid projectRoot: ${projectRoot || "undefined"}. Falling back to: ${validRoot}`);
    }
    this.projectRoot = validRoot;
    this.mode = mode; // minimal, standard, debug
    this.ledger = {
      traceId,
      timestamp: new Date().toISOString(),
      entries: [],
    };
    // Coalesce per-entry trace writes (hot loop: _persist ran on every entry).
    // Config via WAM_AUDIT_BATCH_SIZE / WAM_AUDIT_IDLE_MS / WAM_TASK_DIR_MAX.
    this._coalescer = createAuditCoalescer({
      maxEntries: Number(process.env.WAM_AUDIT_BATCH_SIZE) || 50,
      maxBytes: 65536,
      idleMs: Number(process.env.WAM_AUDIT_IDLE_MS) || 2000,
      dirPath: path.join(this.projectRoot, ".wam", "traces"),
      filePath: path.join(this.projectRoot, ".wam", "traces", `${this.traceId}.json`),
      maxTaskDirs: Number(process.env.WAM_TASK_DIR_MAX) || 500,
      now: Date.now,
      fs,
      log: (msg) => logger.info("AuditPersist", msg),
      // Each persist is a complete ledger snapshot -> keep only the latest.
      state: true,
      // The tracer owns its traces dir; create it on first flush.
      createIfMissing: true,
    });
  }

  _getTraceFile() {
    let current = this.projectRoot;

    while (current !== path.parse(current).root) {
      if (fs.existsSync(path.join(current, ".wam"))) {
        // Verify this is a project root to avoid accidental jumps
        const isProjectRoot = fs.existsSync(path.join(current, "package.json")) ||
                             fs.existsSync(path.join(current, ".opencode.jsonc"));

        if (isProjectRoot) {
          const traceDir = path.join(current, ".wam", "traces");
          if (!fs.existsSync(traceDir)) {
            fs.mkdirSync(traceDir, { recursive: true });
          }
          return path.join(traceDir, `${this.traceId}.json`);
        }
      }
      current = path.dirname(current);
    }

    // Fallback to original behavior if no qualified root found
    const traceDir = path.join(this.projectRoot, ".wam", "traces");
    if (!fs.existsSync(traceDir)) {
      fs.mkdirSync(traceDir, { recursive: true });
    }
    return path.join(traceDir, `${this.traceId}.json`);
  }

  /**
   * Public flush for tests and external callers that need synchronous
   * persistence before proceeding.  Fail-open: never throws.
   */
  flush() {
    this._coalescer.flush();
  }

  _persist() {
    // Route through the audit coalescer: batches writes, skips when
    // .wam/traces is missing/unwritable, skips idempotent (unchanged)
    // content, and emits a single summary line per flush. Fail-open.
    this._coalescer.push(this.ledger);
    this._coalescer.capTaskDirs(
      path.join(this.projectRoot, ".wam", "tasks"),
      Number(process.env.WAM_TASK_DIR_MAX) || 500,
    );
  }

  _addEntry(type, data) {
    // _persist() already swallows persistence failures; ledger update is in-memory only.
    this.ledger.entries.push({
      type,
      timestamp: new Date().toISOString(),
      ...data,
    });
    this._persist();
  }

  logConceptExtraction(concept, metadata = {}) {
    this._addEntry("CONCEPT_EXTRACTION", { concept, metadata });
  }

  logDictionaryResolution(term, resolution, metadata = {}) {
    this._addEntry("DICTIONARY_RESOLUTION", { term, resolution, metadata });
  }

  logCandidateRetrieval(query, candidatesCount, metadata = {}) {
    this._addEntry("CANDIDATE_RETRIEVAL", { query, candidatesCount, metadata });
  }

  logSelectionDecision(candidateId, evidenceClassification, reason, metadata = {}) {
    this._addEntry("SELECTION_DECISION", {
      candidateId,
      evidenceClassification, // e.g., 'direct', 'inferred', 'probabilistic'
      reason,
      metadata,
    });
  }

  /**
   * Registra una decisión técnica con punto de bifurcación, racional, alternativas
   * evaluadas, evidencia y métricas técnicas opcionales. Usado por el Decision Gate
   * para forzar documentación de elecciones arquitectónicas o de modelo de datos.
   *
   * @param {string} decisionPoint  - Qué se decidió (ej: "nuevo servicio X", "cambio de schema Y").
   * @param {string} rationale      - Por qué se eligió esta ruta.
   * @param {Array}  alternatives   - Alternativas descartadas [{name, pros, cons, whyRejected}].
   * @param {Array}  evidence       - Evidencia técnica (benchmarks, docs, RFCs, links, file:line).
   * @param {Object} [technicalMetrics] - Métricas técnicas (latencia, costo, complejidad, etc.).
   */
  logTechnicalDecision(decisionPoint, rationale, alternatives, evidence, technicalMetrics = {}) {
    this._addEntry("TECHNICAL_DECISION", {
      decisionPoint,
      rationale,
      alternatives: Array.isArray(alternatives) ? alternatives : [],
      evidence: Array.isArray(evidence) ? evidence : [],
      technicalMetrics: technicalMetrics || {},
    });
  }
}

/**
 * Valid sources per spec: N0_POLICY, N1_PROJECT, N2_TASK, OBSERVED
 */
const VALID_SOURCES = new Set(["N0_POLICY", "N1_PROJECT", "N2_TASK", "OBSERVED"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);
const VALID_STATUS = new Set(["accepted", "rejected", "provisional"]);

/**
 * Audit a single context-influenced decision and append to contract.contextDecisions.
 * Per spec: { id, date, source, statement, reason, confidence, status }
 *
 * @param {Object} contract     - The task contract (must have contextDecisions array, or one is created)
 * @param {Object} decision     - { statement, reason, source, confidence, status }
 * @returns {Object} the recorded decision entry
 */
export function auditDecision(contract, decision) {
  if (!contract || typeof contract !== "object") {
    throw new Error("auditDecision: contract must be an object");
  }
  if (!decision || typeof decision !== "object") {
    throw new Error("auditDecision: decision must be an object");
  }

  const { statement, reason, source, confidence, status } = decision;

  if (typeof statement !== "string" || statement.length === 0) {
    throw new Error("auditDecision: statement is required");
  }
  if (typeof reason !== "string" || reason.length === 0) {
    throw new Error("auditDecision: reason is required");
  }
  if (!VALID_SOURCES.has(source)) {
    throw new Error(
      `auditDecision: source must be one of N0_POLICY|N1_PROJECT|N2_TASK|OBSERVED (got: ${source})`,
    );
  }
  if (!VALID_CONFIDENCE.has(confidence)) {
    throw new Error(
      `auditDecision: confidence must be high|medium|low (got: ${confidence})`,
    );
  }
  if (!VALID_STATUS.has(status)) {
    throw new Error(
      `auditDecision: status must be accepted|rejected|provisional (got: ${status})`,
    );
  }

  if (!Array.isArray(contract.contextDecisions)) {
    contract.contextDecisions = [];
  }

  const id = `CD${contract.contextDecisions.length + 1}`;
  const entry = {
    id,
    date: new Date().toISOString(),
    source,
    statement,
    reason,
    confidence,
    status,
  };
  contract.contextDecisions.push(entry);
  return entry;
}

/**
 * Inspect the audit trail: returns the contract.contextDecisions array
 * (or an empty list if none).
 */
export function inspectAudit(contract) {
  if (!contract || typeof contract !== "object") return [];
  return Array.isArray(contract.contextDecisions) ? contract.contextDecisions : [];
}

/**
 * Audit gate. Returns { allowed, reason } indicating whether completion /
 * approval is permitted.
 *
 * Rule: any decision that is (status === "provisional") OR (status ===
 * "accepted" AND confidence === "low") is treated as a CRITICAL unverified
 * context decision and blocks completion until resolved (accepted with
 * medium/high, or rejected).
 */
export function auditGate(contract) {
  const decisions = inspectAudit(contract);
  const blocking = decisions.filter(
    (d) =>
      d.status === "provisional" ||
      (d.status === "accepted" && d.confidence === "low"),
  );
  if (blocking.length === 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Blocked by ${blocking.length} unverified context decision(s): ${blocking
      .map((d) => d.id)
      .join(", ")}`,
    blocking,
  };
}

/**
 * Resolve a decision by id (used by /wam resolve-decision CLI).
 * Updates status/confidence on the matching entry.
 */
export function resolveDecision(contract, id, updates) {
  if (!contract || typeof contract !== "object") {
    throw new Error("resolveDecision: contract must be an object");
  }
  const decisions = inspectAudit(contract);
  const idx = decisions.findIndex((d) => d.id === id);
  if (idx === -1) {
    throw new Error(`resolveDecision: decision ${id} not found`);
  }
  if (!updates || typeof updates !== "object") {
    throw new Error("resolveDecision: updates must be an object");
  }
  const current = decisions[idx];
  if (updates.status !== undefined) {
    if (!VALID_STATUS.has(updates.status)) {
      throw new Error(
        `resolveDecision: status must be accepted|rejected|provisional`,
      );
    }
    current.status = updates.status;
  }
  if (updates.confidence !== undefined) {
    if (!VALID_CONFIDENCE.has(updates.confidence)) {
      throw new Error(`resolveDecision: confidence must be high|medium|low`);
    }
    current.confidence = updates.confidence;
  }
  if (updates.statement !== undefined) {
    if (typeof updates.statement !== "string" || updates.statement.length === 0) {
      throw new Error("resolveDecision: statement must be a non-empty string");
    }
    current.statement = updates.statement;
  }
  if (updates.reason !== undefined) {
    if (typeof updates.reason !== "string" || updates.reason.length === 0) {
      throw new Error("resolveDecision: reason must be a non-empty string");
    }
    current.reason = updates.reason;
  }
  decisions[idx] = current;
  return current;
}
