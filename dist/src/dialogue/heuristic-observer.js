import { isCompletionIntent } from "../integration/orchestration.js";
import { classifyIntentLane, INTENT_LANES } from "../policy/intent-router.js";
import { isMetaOnlyPrompt } from "../policy/request-classifier.js";
import { DIALOGUE_INTENTS, emptyObservation, normalizeObservation } from "./observation.js";
import { dialogueStateFromTask } from "./dialogue-state.js";

const APPROVAL_RE =
  /^(s[ií]|ok|okey|dale|hazlo|adelante|continuar|contin[uú]a|aprobar|apruebo|confirmo|correcto|perfecto|bueno|va|listo|sigue|yes|yep|sure)(?=\s|$|[,.!?])/i;
const REJECTION_RE =
  /^(no|nel|ni\b|rechazo|rechazar|cancela|cancelar|todav[ií]a no|espera|para|nope|not yet)(?=\s|$|[,.!?])/i;
const EXECUTE_RE =
  /\b(hazlo|ejecuta|ejecutar|implementa|implementar|dale|contin[uú]a|contin[uú]e|sigue|adelante|run|execute|implement|do it|go ahead)\b/i;
const VERIFY_RE =
  /\b(verifica|verificar|comprueba|comprobar|corre (los )?tests?|run (the )?tests?|validate|check|testea)\b/i;
const CORRECTION_RE =
  /\b(no,|no era|en realidad|mejor|corrige|corregir|arregla|error|falla|bug|incorrecto|mal)\b/i;
const DEFINE_RE =
  /\b(debe|deben|tiene que|tienen que|requiere|requieren|necesito|necesita|must|should|requirement|constraint)\b/i;
const CONSTRAINT_RE =
  /\b(sin|no debe|nunca|solo|s[oó]lo|m[aá]ximo|m[aá]ximo|m[ií]nimo|limite|l[ií]mite|dentro de|antes de|at most|at least|only)\b/i;
const ACCEPTANCE_RE =
  /\b(cuando|si |test|tests|prueba|pruebas|verifica|verificar|aceptaci[oó]n|criterio|debe pasar|passing|acceptance)\b/i;
const GOAL_RE =
  /\b(necesito|quiero|crea|crear|agrega|agregar|a[ñn]ade|a[ñn]adir|implementa|implementar|construye|build|create|add|implement|fix|arregla)\b/i;
const QUESTION_RE =
  /^(qu[eé]|c[oó]mo|cu[aá]l|cu[aá]ndo|d[oó]nde|por qu[eé]|puedes|podr[ií]as|what|how|why|where|when|can you|could you)\b|\?\s*$/i;
const SCOPE_CHANGE_RE =
  /\b(otra cosa|otro objetivo|nuevo objetivo|mejor haz|en realidad era|cambia el objetivo|scope change|new goal)\b/i;

function detectLanguage(text) {
  if (/[ñáéíóú¿¡]/i.test(text)) return "es";
  if (/\b(el|la|los|las|de|que|para|con|una|un|por|como|esta|ve|si)\b/i.test(text)) return "es";
  if (/\b(the|and|with|for|this|that|you|please)\b/i.test(text)) return "en";
  if (/\b(voce|para|com|uma|não|nao|isso)\b/i.test(text)) return "pt";
  return "unknown";
}

function splitClauses(text) {
  return String(text ?? "")
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 4);
}

function classifyContribution(clause) {
  if (QUESTION_RE.test(clause)) return "question";
  if (ACCEPTANCE_RE.test(clause)) return "acceptance_criterion";
  if (CONSTRAINT_RE.test(clause)) return "constraint";
  if (CORRECTION_RE.test(clause)) return "correction";
  if (DEFINE_RE.test(clause)) return "requirement";
  if (GOAL_RE.test(clause)) return "goal";
  return null;
}

const CONTRIBUTION_INTENTS = new Set([
  DIALOGUE_INTENTS.PROVIDE_REQUIREMENT,
  DIALOGUE_INTENTS.DEFINE,
  DIALOGUE_INTENTS.ADD_CONSTRAINT,
  DIALOGUE_INTENTS.ADD_ACCEPTANCE_CRITERION,
  DIALOGUE_INTENTS.CORRECT,
]);

function extractContributions(text, intent) {
  if (!CONTRIBUTION_INTENTS.has(intent)) return [];
  const contributions = [];
  for (const clause of splitClauses(text)) {
    const kind = classifyContribution(clause);
    if (kind) contributions.push({ kind, text: clause, confidence: 0.7 });
  }
  if (
    !contributions.length &&
    intent === DIALOGUE_INTENTS.DEFINE
  ) {
    contributions.push({ kind: "goal", text: String(text).trim(), confidence: 0.5 });
  }
  return contributions;
}

function extractClaims(text) {
  const lower = String(text ?? "").toLowerCase();
  const claims = [];
  if (/\b(tests?|pruebas?)\b.*\b(pasan|pasaron|pass|passing|ok)\b/i.test(lower)) {
    claims.push({ kind: "test_pass", text: "tests pass", confidence: 0.8 });
  }
  if (/\b(listo|terminado|completado|hecho|done|finished)\b/i.test(lower)) {
    claims.push({ kind: "completion", text: "completion claimed", confidence: 0.8 });
  }
  if (/\b(verifiqu[eé]|comprob[eé]|revis[eé]|verified|checked)\b/i.test(lower)) {
    claims.push({ kind: "manual_verification", text: "manual verification claimed", confidence: 0.7 });
  }
  return claims;
}

function riskFlags(text) {
  const flags = [];
  if (/\b(rm -rf|borra|borrar|elimina|eliminar|drop table|delete|destruye|destructive)\b/i.test(text)) {
    flags.push("destructive");
  }
  if (/\b(permiso|permission|chmod|sudo|root)\b/i.test(text)) flags.push("permission");
  if (/\b(api\s*[_-]?\s*key|password|contrase[ñn]a|secret|token)\b/i.test(text)) flags.push("secret");
  if (/\b(deploy|despliega|push|publica|publish|release)\b/i.test(text)) {
    flags.push("external_side_effect");
  }
  return flags;
}

function pickIntent({ text, lane, dialogue, taskState }) {
  const pending = dialogue?.pendingQuestion;
  const hasTask = Boolean(taskState?.requirements?.length);
  const stage = dialogue?.stage || "IDLE";

  if (pending && APPROVAL_RE.test(text.trim())) return DIALOGUE_INTENTS.APPROVE;
  if (pending && REJECTION_RE.test(text.trim())) return DIALOGUE_INTENTS.REJECT;
  if (isCompletionIntent(text)) return DIALOGUE_INTENTS.CLAIM_DONE;
  if (EXECUTE_RE.test(text) && (hasTask || stage === "APPROVED" || stage === "EXECUTING")) {
    return DIALOGUE_INTENTS.EXECUTE;
  }
  if (hasTask && !EXECUTE_RE.test(text) && (APPROVAL_RE.test(text.trim()) || REJECTION_RE.test(text.trim()))) {
    return DIALOGUE_INTENTS.ANSWER;
  }
  if (isMetaOnlyPrompt(text)) return DIALOGUE_INTENTS.META;
  if (VERIFY_RE.test(text)) return DIALOGUE_INTENTS.VERIFY;
  if (CORRECTION_RE.test(text) && lane === INTENT_LANES.CORRECTION) {
    return DIALOGUE_INTENTS.CORRECT;
  }
  if (QUESTION_RE.test(text.trim()) && !EXECUTE_RE.test(text)) {
    return DIALOGUE_INTENTS.CLARIFY;
  }
  if (ACCEPTANCE_RE.test(text)) return DIALOGUE_INTENTS.ADD_ACCEPTANCE_CRITERION;
  if (CONSTRAINT_RE.test(text) && DEFINE_RE.test(text)) {
    return DIALOGUE_INTENTS.ADD_CONSTRAINT;
  }
  if (stage === "IDLE" && GOAL_RE.test(text)) return DIALOGUE_INTENTS.PROVIDE_REQUIREMENT;
  if (DEFINE_RE.test(text)) return DIALOGUE_INTENTS.DEFINE;
  if (EXECUTE_RE.test(text)) {
    if (stage === "APPROVED" || stage === "EXECUTING" || stage === "VERIFYING") {
      return DIALOGUE_INTENTS.EXECUTE;
    }
    if (stage === "IDLE" || stage === "INTAKE" || stage === "ELICITATION") {
      return DIALOGUE_INTENTS.EXECUTE;
    }
    return DIALOGUE_INTENTS.EXECUTE;
  }
  if (lane === INTENT_LANES.CONTINUATION) return DIALOGUE_INTENTS.EXECUTE;
  if (lane === INTENT_LANES.CORRECTION) return DIALOGUE_INTENTS.CORRECT;
  if (lane === INTENT_LANES.TASK_NEW || hasTask) return DIALOGUE_INTENTS.PROVIDE_REQUIREMENT;
  if (lane === INTENT_LANES.CONVERSATION) return DIALOGUE_INTENTS.META;
  return DIALOGUE_INTENTS.UNKNOWN;
}

export function heuristicObserve({ message, taskState } = {}) {
  const text = String(message ?? "").trim();
  const dialogue = dialogueStateFromTask(taskState);
  if (
    !dialogue.pendingQuestion &&
    taskState?.contract?.status === "PROPOSED" &&
    taskState?.phase === "PROPOSED" &&
    Array.isArray(taskState?.requirements) &&
    taskState.requirements.length > 0
  ) {
    dialogue.pendingQuestion = "contract_approval";
  }
  const lane = classifyIntentLane(text, {
    phase: taskState?.phase,
    contractStatus: taskState?.contract?.status,
    hasActiveTask: Boolean(taskState?.requirements?.length),
  }).lane;
  const intent = pickIntent({ text, lane, dialogue, taskState });
  const pending = dialogue.pendingQuestion;
  const answers =
    Boolean(pending) &&
    (APPROVAL_RE.test(text) ||
      REJECTION_RE.test(text) ||
      (text.length <= 80 &&
        intent !== DIALOGUE_INTENTS.CLARIFY &&
        intent !== DIALOGUE_INTENTS.META));
  const contributions = extractContributions(text, intent);
  const claims = extractClaims(text);
  const actionable =
    GOAL_RE.test(text) || EXECUTE_RE.test(text) || DEFINE_RE.test(text) || VERIFY_RE.test(text);
  const weakRequirement =
    intent === DIALOGUE_INTENTS.PROVIDE_REQUIREMENT && !actionable;
  const ambiguity =
    pending && (APPROVAL_RE.test(text) || REJECTION_RE.test(text))
      ? "low"
      : text.length < 3 || /\?\?/.test(text)
        ? "high"
        : intent === DIALOGUE_INTENTS.UNKNOWN || weakRequirement
          ? "medium"
          : "low";

  const observation = emptyObservation({
    language: detectLanguage(text),
    intent,
    speech_act:
      intent === DIALOGUE_INTENTS.CLARIFY
        ? "question"
        : intent === DIALOGUE_INTENTS.APPROVE
          ? "confirmation"
          : intent === DIALOGUE_INTENTS.REJECT
            ? "rejection"
            : intent === DIALOGUE_INTENTS.EXECUTE
              ? "command"
              : "assertion",
    polarity:
      REJECTION_RE.test(text) || /\bno\b/i.test(text)
        ? /\bpero\b/i.test(text)
          ? "mixed"
          : "negative"
        : /\bpero\b/i.test(text)
          ? "mixed"
          : "affirmative",
    confidence:
      intent === DIALOGUE_INTENTS.UNKNOWN
        ? 0.3
        : intent === DIALOGUE_INTENTS.META ||
            intent === DIALOGUE_INTENTS.CLAIM_DONE ||
            intent === DIALOGUE_INTENTS.APPROVE ||
            intent === DIALOGUE_INTENTS.REJECT
          ? 0.9
          : intent === DIALOGUE_INTENTS.EXECUTE || intent === DIALOGUE_INTENTS.VERIFY
            ? 0.8
            : weakRequirement
              ? 0.55
              : 0.75,
    answers_pending_question: answers,
    references_active_task: Boolean(taskState),
    scope_change: SCOPE_CHANGE_RE.test(text),
    ambiguity,
    contributions,
    claims,
    risk_flags: riskFlags(text),
  });

  return normalizeObservation(observation);
}
