import { findRepeatedExperiment, hasRepetitiveFailure } from "../cognition/cognition-store.js";
import { readLedger } from "../context/session-file-read-ledger.js";
import { evaluateDiscovery } from "../policy/discovery-classifier.js";
import { evaluateAction } from "../policy/risk-engine.js";
import { getCapability, CAPABILITY_LEVELS } from "../policy/action-capabilities.js";
import { guardSubagentDispatch, loadModelRegistry } from "../skills/subagent-model-availability.js";
import { loadPrompt } from "../prompts/loader.js";
import fs from "node:fs";

const HARD_DELETE_RE =
  /\b(rmdir|unlink|shred|truncate)\b|\brm\s+(-[a-zA-Z]*f|--force)|\bgit\s+reset\s+--hard\b|\b(DROP|TRUNCATE)\s+(TABLE|DATABASE)\b/i;

const HARD_DELETE_TOOLS = new Set(["rm", "rmdir"]);

function isHardDelete(tool, args = {}) {
  const t = String(tool || "").toLowerCase();
  if (HARD_DELETE_TOOLS.has(t)) return true;
  const cmd = String(args.command || args.cmd || "");
  return HARD_DELETE_RE.test(cmd);
}

function actionDescription(tool, args = {}) {
  const { hypothesisId: _h, ...rest } = args;
  return `${tool}:${JSON.stringify(rest)}`;
}

/**
 * Autonomy Runtime Guards
 *
 * Intercepta ejecución para evaluar:
 * 1. Riesgo de la acción (Risk Envelope)
 * 2. Stagnation/Repetition (cognition-store)
 * 3. Hard-delete ban (U1: soft-archive only)
 * 4. Scope enforcement
 */
export async function guardAction(tool, args, taskRoot, taskId) {
  // 0. Fail-closed (C01): herramientas no catalogadas se bloquean aquí,
  //    ANTES de cualquier otra evaluación. Esto crea una segunda línea
  //    de defensa independiente del risk-engine: aunque la evaluación
  //    contextual cambie, una herramienta desconocida nunca llega a
  //    ejecutarse.
  const capability = getCapability(tool);
  if (capability === CAPABILITY_LEVELS.UNKNOWN) {
    return {
      allowed: false,
      level: "BLOCKED",
      reason: `fail-closed: herramienta no catalogada (${tool})`,
    };
  }

  // Session File Read Ledger Guard
  if (tool === "read") {
    const path = args.filePath || args.path || args.file;
    if (path && fs.existsSync(path)) {
      try {
        const content = fs.readFileSync(path, 'utf8');
        const redundant = readLedger.isRedundant(path, content);
        readLedger.recordRead(path, content);
        if (redundant) {
          return {
            allowed: true,
            level: "INFO",
            nudge: loadPrompt("nudge.runtime.redundant_read", { path }),
          };
        }
      } catch (e) {}
    }
  } else if (tool === "edit") {
    const path = args.filePath || args.path;
    if (path && fs.existsSync(path)) {
      try {
        const content = fs.readFileSync(path, 'utf8');
        if (readLedger.checkStale(path, content)) {
          return {
            allowed: false,
            level: "BLOCKED",
            reason: loadPrompt("reason.runtime.stale_buffer", { path }),
          };
        }
      } catch (e) {
        console.error("Ledger check error:", e);
      }
    }
  }

  if (tool === "task" || tool === "subagent") {
    const registry = loadModelRegistry({ configPath: process.env.WAM_MODEL_ROUTER_CONFIG });
    const maxDepth = parseInt(process.env.WAM_SUBAGENT_MAX_DEPTH || "1", 10);
    const guardResult = guardSubagentDispatch(tool, args, { registry, maxDepth });
    if (!guardResult.allowed) return guardResult;
  }

  if (isHardDelete(tool, args)) {
    return {
      allowed: false,
      level: "BLOCKED",
      reason: "hard delete forbidden (U1: soft-archive only)",
    };
  }

  let risk;
  try {
    risk = evaluateAction(tool, args, taskRoot);
  } catch (err) {
    const name = err?.name || err?.constructor?.name;
    if (name === "WamPolicyBlock") {
      return { allowed: false, level: "BLOCKED", reason: err.message };
    }
    throw err;
  }

  if (risk.level === "BLOCKED") {
    return {
      allowed: false,
      level: "BLOCKED",
      reason: risk.reason || "destructive or irreversible action blocked",
    };
  }

  const desc = actionDescription(tool, args);
  const probe = {
    hypothesisId: args?.hypothesisId || "unknown",
    actionDescription: desc,
  };

  if (hasRepetitiveFailure(taskRoot, taskId, probe)) {
    return {
      allowed: false,
      level: risk.level,
      reason: "repetitive failure: same hypothesis+action already failed. Replan with a new hypothesis.",
    };
  }

  const repeated = findRepeatedExperiment(taskRoot, taskId, probe);

  // Insert discovery evaluation after repetitive checks
  let discovery = null;
  if (tool === "bash" || tool === "sh") {
    try {
      discovery = evaluateDiscovery(tool, args, taskRoot, taskId);
    } catch (e) {
      // Fail open: if classification throws, we allow the action
      discovery = null;
    }
  }

  const baseReturn = { allowed: true, level: risk.level };
  if (discovery) {
    if (discovery.nudge) baseReturn.nudge = discovery.nudge;
    if (discovery.workdir) baseReturn.workdirSuggestion = discovery.workdir;
  }

  if (risk.level === "GUARDED" && !args?.hypothesisId) {
    return {
      ...baseReturn,
      warning: loadPrompt("warning.runtime.guarded_no_hypothesis"),
    };
  }

  if (repeated) {
    return {
      ...baseReturn,
      warning: loadPrompt("warning.runtime.repetition", { status: repeated.status }),
    };
  }

  return baseReturn;
}
