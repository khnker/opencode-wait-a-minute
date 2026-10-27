/**
 * State-aware intent router.
 *
 * Four lanes keep conversation, continuation, correction and new tasks apart so
 * WAM does not synthesize contracts for meta messages or re-synthesize one on a
 * follow-up.
 */

import { classifyRequest, isMetaOnlyPrompt } from "./request-classifier.js";

export const INTENT_LANES = Object.freeze({
  CONVERSATION: "CONVERSATION",
  CONTINUATION: "CONTINUATION",
  CORRECTION: "CORRECTION",
  TASK_NEW: "TASK_NEW",
});

const CONTINUATION_RE =
  /\b(sigue|contin[uú]a|contin[uú]e|adelante|dale|retoma|retomar|como\s+ibamos|en\s+qu[eé]\s+estabamos|paso\s+\d+)\b/i;

const CORRECTION_RE =
  /\b(no,?\s*era|en\s+realidad|mejor\s+dicho|corrige|correcci[oó]n|cambia\s+(eso|esto)|no\s+es\s+as[ií]|equivocaste)\b/i;

const TASK_VERB_RE =
  /\b(implementa|implementar|crea|crear|agrega|agregar|arregla|arreglar|refactoriza|refactorizar|migra|migrar|configura|configurar|habilita|habilitar|elimina|eliminar|documenta|documentar|audita|auditar|analiza|analizar|revisa|revisar|eval[uú]a|evaluar|investiga|investigar|mira|ve\s+que|build|create|implement|add|fix|refactor|migrate|configure|enable|delete|remove|analyze|review|document|audit|evaluate|investigate)\b/i;

/**
 * @param {string} prompt
 * @param {{ phase?: string, contractStatus?: string, hasActiveTask?: boolean }} [context]
 * @returns {{ lane: string, confidence: number, reasons: string[] }}
 */
export function classifyIntentLane(prompt, context = {}) {
  const text = String(prompt ?? "").trim();
  if (!text) {
    return { lane: INTENT_LANES.CONVERSATION, confidence: 0.95, reasons: ["empty"] };
  }
  if (isMetaOnlyPrompt(text)) {
    return { lane: INTENT_LANES.CONVERSATION, confidence: 0.95, reasons: ["meta-only"] };
  }
  if (CORRECTION_RE.test(text)) {
    return { lane: INTENT_LANES.CORRECTION, confidence: 0.9, reasons: ["correction-marker"] };
  }
  if (context.hasActiveTask && CONTINUATION_RE.test(text)) {
    return { lane: INTENT_LANES.CONTINUATION, confidence: 0.85, reasons: ["continuation-marker", "active-task"] };
  }

  const classification = classifyRequest(text);
  if (classification.type === "trivial" && !TASK_VERB_RE.test(text)) {
    return { lane: INTENT_LANES.CONVERSATION, confidence: 0.8, reasons: ["trivial"] };
  }
  if (TASK_VERB_RE.test(text)) {
    return { lane: INTENT_LANES.TASK_NEW, confidence: 0.8, reasons: ["task-verb"] };
  }

  return {
    lane: INTENT_LANES.TASK_NEW,
    confidence: 0.6,
    reasons: [`classifier:${classification.type}`],
  };
}
