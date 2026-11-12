/**
 * Orchestration — funciones puras de decisión/estado extraídas de index.js.
 *
 * Este módulo contiene Toda la lógica de decisión del ciclo de vida:
 *   - Gestión de fases (PROPOSED→APPROVED→IMPLEMENTING→VERIFYING→DONE)
 *   - Transiciones de estado (approve/reject/edit contract, mark requirement)
 *   - Completion gate (evaluate, apply phase transition)
 *
 * Las funciones aquí son PURAS: toman estado como entrada, retornan
 * decisión como salida. Sin side effects (no persisten, no leen, no escriben).
 *
 * index.js (OpenCode Adapter) importa estas funciones y se encarga de
 * los side effects: getTaskState, persistTaskState, updateLiveContext, etc.
 */

import { evaluateRequirement as evaluateRequirementChecks } from "../verification/verification.js";
import { truncate } from "../execution/formatting.js";
import { evaluateOutcome, OUTCOME_STATUSES } from "../verification/outcome-evaluator.js";
import { evaluateCompletionInvariants } from "../verification/completion-invariants.js";
import { nextActionFrom } from "../state/next-action.js";
import { isContinuationInstruction } from "../policy/request-classifier.js";

export { nextActionFrom };

// ═══════════════════════════════════════════════════════════════
// Completion-intent detection
// ═══════════════════════════════════════════════════════════════
//
// Ponytail: the completion gate fires only when the prompt's primary intent
// is to assert completion. We classify completion intent here, in one place,
// so the gate and the message-handler anti-tampering check use the exact
// same predicate. Incidental word usage ("complete disaster", "I am done
// with lunch", "the unfinished file") must NOT be classified as completion
// intent — that was the false-positive root cause.
export const COMPLETION_INTENT_REGEX = new RegExp(
  [
    // 0a. Imperative "done"/"listo"/"terminado" at start
    "^(done|listo|terminado|terminada|completado|completada|completed|finished|finalizado|finalizada)\\b",
    // 0b. Verb at sentence boundary followed by task/object pronoun
    "(^|[.!?\\n,;]\\s*)(done|finish|finished|complete|completed|terminate|terminated|termino|listo|finalizado|finalizada|completado|completada)\\s+(the|my|this|that|task|tarea|it|all|everything|with\\s+this|ya)\\b",
    // 0c. "I'm done" / "we are done" / "we're done"
    "(^|[.!?\\n,;]\\s*)(i|we|yo)(\\s|')+(am|m|are|re)\\s+(done|list[oa]|finished|terminad[oa])\\b",
    // 0c2. Spanish: "estoy listo" / "estoy terminado" / "estamos listos"
    "(^|[.!?\\n,;]\\s*)(estoy|estamos)\\s+(list[oa]|terminad[oa]|completad[oa]|finalizad[oa])\\b",
    // 0d. Explicit close phrases ("declare done", "mark complete", "consider it finished")
    "(^|[.!?\\n,;]\\s*)(declare|mark|consider(ar)?|treat)\\s+(it|this|the\\s+task|task|la\\s+tarea)?\\s*.*\\b(done|complete|completed|finished|terminat(e|ed))\\b",
    // 0e. Spanish: "tarea completa/terminada/lista" and "está terminada"
    "(^|[.!?\\n,;]\\s*)(tarea|trabajo)\\s+(completa|completada|terminada|lista|finalizada)\\b",
    "(^|[.!?\\n,;]\\s*)(la\\s+tarea|el\\s+trabajo)\\s+(est[aá]|est[aá]n)\\s+(terminad[oa]|completad[oa]|list[oa]|finalizad[oa])\\b",
    "(^|[.!?\\n,;]\\s*)(termin[eé]|termine)\\s+(la\\s+)?tarea\\b",
    "\\b(est[aá]|estoy|estamos)\\s+done\\b",
    // 0h. Task-scoped completion claim ("task complete", "the task is complete")
    "\\b(task|tarea|trabajo|this|everything|all)\\s+(is\\s+)?(complete|completed|done|finished|completo|completa|terminado|terminada)\\b",
    // 0g. Soft completion claim ("todo ok", "todo listo", "ya está, todo hecho")
    "\\b(todo|toda)\\s+(ok|listo|listos|hecho|hecha|hechos|terminado|terminada|completo|completa|resuelto|resuelta)\\b",
    // 0f. Trailing DONE-claim ("todo listo, done", "hecho, terminado")
    "(^|[,;.!?]\\s*)\\b(done|listo|terminado|terminada|completado|completada|finalizado|finalizada)\\s*[.!]?$",
  ].join("|"),
  "i",
);

/**
 * Classify whether a user prompt asserts completion intent.
 * PURE. Returns true only when the prompt's primary intent is to declare
 * the task done — not on incidental word usage.
 * @param {string} promptText
 * @returns {boolean}
 */
export function isCompletionIntent(promptText) {
  if (!promptText || typeof promptText !== "string") return false;
  const text = promptText.toLowerCase().trim();
  // Una pregunta no es un claim de completitud ("¿ya está?", "is it complete?").
  if (text.endsWith("?")) return false;
  // "listo sigue" / "ok, continúa" son instrucciones de continuación, no claims.
  if (isContinuationInstruction(text)) return false;
  return COMPLETION_INTENT_REGEX.test(text);
}

// ═══════════════════════════════════════════════════════════════
// Constantes de fase
// ═══════════════════════════════════════════════════════════════

export const PHASE_PROPOSED = "PROPOSED";
export const PHASE_APPROVED = "APPROVED";
export const PHASE_IMPLEMENTING = "IMPLEMENTING";
export const PHASE_VERIFYING = "VERIFYING";
export const PHASE_DONE = "DONE";
export const PHASE_ASKING = "ASKING";
export const PHASE_WAITING = "WAITING";

/**
 * Transiciones válidas de fase.
 * Cada clave es una fase origen, el array fases destino permitidas.
 */
export const PHASE_TRANSITIONS = Object.freeze({
  [PHASE_PROPOSED]: [PHASE_IMPLEMENTING, PHASE_WAITING, PHASE_ASKING],
  [PHASE_IMPLEMENTING]: [PHASE_VERIFYING, PHASE_DONE, PHASE_ASKING],
  [PHASE_VERIFYING]: [PHASE_IMPLEMENTING, PHASE_DONE],
  [PHASE_DONE]: [],
  [PHASE_ASKING]: [PHASE_PROPOSED, PHASE_IMPLEMENTING],
  [PHASE_WAITING]: [PHASE_PROPOSED, PHASE_IMPLEMENTING],
});

/**
 * Valida si una transición de fase es permitida.
 * @param {string} from - Fase origen
 * @param {string} to - Fase destino
 * @returns {boolean}
 */
export function canTransitionPhase(from, to) {
  return (PHASE_TRANSITIONS[from] || []).includes(to);
}

// ═══════════════════════════════════════════════════════════════
// nextActionFrom — cálculo puro del próximo action
// ═══════════════════════════════════════════════════════════════

// Eliminada definición local de truncate, usando import de formatting.js

/**
 * Determina la próxima acción sugerida según el estado de requirements.
 * @param {Object} state - Estado de la tarea
 * @returns {string}
 */


// ═══════════════════════════════════════════════════════════════
// Completion Gate — evaluación pura
// ═══════════════════════════════════════════════════════════════

/**
 * Evalúa si una tarea puede completarse.
 * PURE: toma state + promptText, retorna gate result sin side effects.
 * @param {Object} state - Estado de la tarea
 * @param {string} promptText - Texto del prompt del usuario
 * @param {{ quality?: Object, enforce?: boolean }} [options] - Quality contract evaluation and opt-in hard blocking
 * @returns {{ blocked: boolean, allDone?: boolean, verifying?: boolean, pending?: string[], autoApprove?: boolean }}
 */
export function evaluateCompletionGate(state, promptText, options = {}) {
  const gate = evaluateCompletionGateStrict(state, promptText);
  const quality = options?.quality;
  const qualityInsufficient = Boolean(quality && quality.enabled !== false && quality.sufficient === false);
  const qualityReasons = Array.isArray(quality?.reasons) ? quality.reasons : [];

  if (options?.enforce === true) {
    if (!gate.blocked && !qualityInsufficient) return gate;
    return {
      ...gate,
      blocked: true,
      advisory: false,
      ok: false,
      pending: [...new Set([...(gate.pending || []), ...qualityReasons])],
    };
  }

  if (qualityInsufficient) {
    return {
      ...gate,
      blocked: false,
      advisory: true,
      ok: false,
      pending: [...(gate.pending || []), ...qualityReasons],
    };
  }
  if (!gate.blocked) return gate;
  return {
    ...gate,
    blocked: false,
    advisory: true,
    recommendation:
      "Recomendación: la tarea no está verificada. Pendiente:\n" +
      (gate.pending || []).map((p) => `- ${p}`).join("\n") +
      "\nVerificá o documentá evidencia cuando puedas; procedo.",
  };
}

function evaluateCompletionGateStrict(state, promptText) {
  const completionIntent = isCompletionIntent(promptText);

  // 1. State-level invariants: decisions, requirements, evidence, backlog.
  const invariants = evaluateCompletionInvariants(state);
  if (!invariants.ok) {
    return {
      blocked: true,
      ...(invariants.verifying ? { verifying: true } : {}),
      pending: invariants.pending,
    };
  }

  // 2. Failing criteria
  const failingCriteria = (state?.completionContract?.criteria || []).filter(
    (c) => c.status === "FAIL" || c.status === "UNKNOWN"
  );
  if (failingCriteria.length > 0) {
    return {
      blocked: true,
      pending: failingCriteria.map(
        (c) => `${c.id} — ${c.criterion} (${c.status})`
      ),
    };
  }

  // 3. Contract status is advisory: nunca bloquea el progreso (0 fricción).

  // 4. Contract checks must pass
   const checks = state?.contract?.checks || [];
   if (checks.length > 0) {
     const byReq = new Map();
     for (const c of checks) {
       if (!byReq.has(c.reqId)) byReq.set(c.reqId, []);
       byReq.get(c.reqId).push(c);
     }
     const checkFailures = [];
     for (const [reqId, list] of byReq) {
       const verdict = evaluateRequirementChecks(list, list);
       if (verdict.status !== "VERIFIED")
         checkFailures.push(`${reqId}: ${verdict.reason || "checks pendientes"}`);
     }
     if (checkFailures.length > 0) {
       return { blocked: true, verifying: true, pending: checkFailures };
     }
   }

   // 5. Outcome evaluation check
   const outcomeContract = state?.outcomeContract;
   if (!outcomeContract) {
     return {
       blocked: true,
       pending: ["Missing outcome contract — outcome contract is required before DONE"],
     };
   }
   try {
     // ponytail: prod seed declares a single mandatory criterion; requirement
     // evidence is mapped onto it. Upgrade to per-criterion tagging if a
     // multi-criterion outcome contract ever appears.
     const outcomeCriterionId = (outcomeContract.acceptanceCriteria || [])[0]?.id;
     const requirementEvidence = (state?.requirements || []).flatMap((r) =>
       (r.evidence || []).map((ev) => ({
         criterionId: outcomeCriterionId,
         status: r.status === "verified" ? "VERIFIED" : "UNVERIFIED",
         timestamp: r.verifiedAt || r.updatedAt || state?.updatedAt || Date.now(),
         description: typeof ev === "string" ? ev : ev?.description || "",
       }))
     );
     const outcomeResult = evaluateOutcome(
       outcomeContract,
       [...(state?.evidence || []), ...requirementEvidence],
       state?.observations || []
     );
     if (!outcomeResult.canComplete || outcomeResult.status !== OUTCOME_STATUSES.ACHIEVED) {
       return {
         blocked: true,
         pending: [`Outcome not achieved (status=${outcomeResult.status}): ${outcomeResult.error || outcomeResult.reasons?.join(", ") || "mandatory criteria unsatisfied"}`],
       };
     }
   } catch (err) {
     return {
       blocked: true,
       pending: [`Outcome evaluator error (fail-closed): ${err.message}`],
     };
   }

   return { blocked: false, allDone: true, completionIntent };
}

/**
 * Determina la transición de fase resultante de un completion gate evaluation.
 * PURE: retorna la nueva fase y nextAction sin persistir.
 * @param {Object} state - Estado actual
 * @param {{ blocked: boolean, allDone?: boolean, verifying?: boolean }} gate - Resultado del gate
 * @returns {{ phase: string, nextAction: string }}
 */
/**
 * Construye la validación que se envía al LLM cuando el completion gate
 * rechaza un claim de completitud (el LLM dijo DONE pero faltan requisitos).
 * PURE: (gate, state) → payload con el texto de validación dirigido al LLM.
 * @param {{blocked?:boolean, verifying?:boolean, pending?:string[]}} gate
 * @param {Object} [state]
 * @returns {{ text:string, pending:string[], nextAction:string, requestedAction:string }}
 */
export function buildCompletionValidation(gate, state = {}) {
  const pending = Array.isArray(gate?.pending) ? gate.pending : [];
  const nextAction = state?.nextAction || nextActionFrom(state);
  const requestedAction = truncate(
    (
      state?.contract?.objective ||
      state?.intent?.goal ||
      state?.requirements?.[0]?.title ||
      "continuar la tarea"
    ).split("\n")[0],
    120,
  );
  const blocked = gate?.blocked === true && gate?.advisory !== true;
  const lines = [
    blocked
      ? "⛔ [wait-a-minute] Completitud bloqueada — la afirmación de completitud no está verificada: el contrato todavía tiene requisitos pendientes."
      : "⚠️ [wait-a-minute] Recomendación — la afirmación de completitud no está verificada: el contrato todavía tiene requisitos pendientes.",
  ];
  if (pending.length > 0) {
    lines.push("Requisitos pendientes:");
    for (const item of pending) lines.push(`- ${truncate(item, 150)}`);
  }
  lines.push(
    blocked
      ? `Objetivo del contrato: "${requestedAction}" → completá y verificá los requisitos pendientes. No declares DONE hasta verificarlos.`
      : `Objetivo del contrato: "${requestedAction}" → cuando puedas, implementa los requisitos pendientes y verificalos. Podés continuar.`,
  );
  lines.push(`Continuar con: ${nextAction}`);
  return {
    text: lines.join("\n"),
    pending,
    nextAction,
    requestedAction,
  };
}

export function applyPhaseTransition(state, gate) {
  if (gate.advisory) {
    return {
      phase: state?.phase || PHASE_PROPOSED,
      nextAction: nextActionFrom(state),
    };
  }
  if (gate.allDone) {
    return {
      phase: PHASE_DONE,
      nextAction: "Tarea completa — contrato verificado",
    };
  }
  return {
    phase: state?.phase || PHASE_PROPOSED,
    nextAction: nextActionFrom(state),
  };
}

// ═══════════════════════════════════════════════════════════════
// Contract transitions — decision logic (pure)
// ═══════════════════════════════════════════════════════════════

/**
 * Lógica para aprobar un contrato (PROPOSED → APPROVED, phase → IMPLEMENTING).
 * PURE: retorna los cambios a aplicar sobre el estado.
 * @param {Object} state - Estado actual
 * @returns {{ ok: boolean, reason?: string, status?: string, phase?: string, nextAction?: string, approvedStrategy?: Object }}
 */
export function approveContractLogic(state) {
  if (!state) return { ok: false, reason: "Sin estado de tarea" };

  const inferredStrategy =
    (state.contract?.objective ||
      state.intent?.goal ||
      state.requirements?.[0]?.title ||
      state.lastAction?.split("\n")[0] ||
      "task execution"
    ).slice(0, 100);

  const allowedActions = [
    "write",
    "edit",
    "bash",
    "sh",
    "task",
    "todowrite",
    "pty_spawn",
    "pty_write",
    "pty_kill",
    "openspec",
    "openspec new change",
    "openspec instructions",
    "openspec validate",
    "openspec archive",
    "git status",
    "git diff",
    "git log",
    "git commit",
    "npm test",
    "pnpm test",
    "pnpm install",
    "crear change OpenSpec",
    "delegar via Task",
  ];

  const prohibitedActions = [
    "delete production data",
    "drop database",
    "production deploy",
    "credential modification",
    "scope expansion",
    "destructive operation",
  ];

  const invalidationConditions = [
    "environment cannot satisfy required runtime",
    "required dependency unavailable and unfixable",
    "explicit user retraction",
    "verified evidence contradicts strategy at architectural level",
  ];

  return {
    ok: true,
    status: "APPROVED",
    phase: state.phase === PHASE_DONE ? state.phase : PHASE_IMPLEMENTING,
    nextAction: nextActionFrom(state),
    approvedStrategy: {
      strategy: inferredStrategy,
      approvedAt: Date.now(),
      scope:
        state.requirements?.map((r) => r.title).join(", ") || inferredStrategy,
      allowedActions,
      prohibitedActions,
      invalidationConditions,
      status: "ACTIVE",
    },
  };
}

/**
 * Lógica para rechazar un contrato (→ REJECTED, phase → WAITING).
 * PURE.
 * @param {Object} state
 * @returns {{ ok: boolean, status: string, phase: string, nextAction: string }}
 */
export function rejectContractLogic(state) {
  return {
    ok: true,
    status: "REJECTED",
    phase: PHASE_WAITING,
    nextAction: "Revisar contrato con el usuario",
  };
}

/**
 * Lógica para editar un contrato (→ vuelve a PROPOSED).
 * PURE.
 * @param {Object} state
 * @returns {{ ok: boolean, status: string, phase: string, nextAction: string }}
 */
export function editContractLogic(state) {
  return {
    ok: true,
    status: "PROPOSED",
    phase: PHASE_PROPOSED,
    nextAction: "Revisar contrato — /wam contract approve o edit",
  };
}

// ═══════════════════════════════════════════════════════════════
// markRequirement — decision logic (pure)
// ═══════════════════════════════════════════════════════════════

/**
 * Lógica para marcar un requisito como done/pending/verified.
 * PURE: valida y retorna cambios al estado. No persiste.
 * @param {Object} state - Estado actual
 * @param {string} reqId - ID del requisito
 * @param {"done"|"pending"|"verified"} status - Nuevo estado
 * @param {string} evidence - Evidencia
 * @returns {{ ok: boolean, reason?: string, phase?: string, nextAction?: string }}
 */
export function markRequirementLogic(state, reqId, status, evidence) {
  if (!state) return { ok: false, reason: "Sin estado de tarea" };

  const req = (state.requirements || []).find((r) => r.id === reqId);
  if (!req) return { ok: false, reason: `Requisito ${reqId} no existe` };

  if (
    (status === "done" || status === "verified") &&
    !(evidence && evidence.trim())
  ) {
    return {
      ok: false,
      reason: `Requisito ${reqId}: evidencia requerida para marcar ${status}`,
    };
  }

  if (status === "verified" && req.status !== "done") {
    return {
      ok: false,
      reason: `Requisito ${reqId}: marcar done antes de verified`,
    };
  }

  // Aplicar cambios al estado (retornar nuevo estado, no mutar)
  let newPhase = state.phase;
  let newNextAction = nextActionFrom(state);

  // Si todos los requirements están verified → auto-advance a VERIFYING
  if (status === "verified") {
    const allVerified = (state.requirements || []).every(
      (r) => r.status === "verified"
    );
    if (allVerified && state.phase !== PHASE_DONE) {
      newPhase = PHASE_VERIFYING;
    }
  }

  return { ok: true, phase: newPhase, nextAction: newNextAction };
}
