// Automatic completion loop — pure planning for post-DONE re-driving.
//
// When the agent claims completion but the gate still has pending work, WAM
// sends the validation back into the session on its own. This module only
// decides *whether* and *what*; the adapter in index.js performs the side
// effects. Keeping it pure makes the runaway-loop policy testable.
import { isCompletionIntent } from "../integration/orchestration.js";

export const DEFAULT_AUTO_LOOP_CAP = 3;
export const DEFAULT_AUTO_LOOP_TOTAL_CAP = 10;
const CLAIM_TAIL_CHARS = 600;

/**
 * Stable identity for a pending set. A different signature means the previous
 * attempt made progress (a requirement got verified, a check resolved, ...).
 */
export function pendingSignature(gate = {}) {
  const pending = Array.isArray(gate?.pending) ? gate.pending : [];
  return pending.map((p) => String(p)).join("\n");
}

/**
 * Completion claim detection limited to the tail of the assistant message so
 * incidental mentions ("the completed file is ...") do not trigger auto-drive.
 */
export function isCompletionClaim(text, { tail = CLAIM_TAIL_CHARS } = {}) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  return isCompletionIntent(trimmed.length > tail ? trimmed.slice(-tail) : trimmed);
}

/**
 * Decide the next auto-continuation.
 *
 * @param {object} input
 * @param {object} input.state       task state (read-only)
 * @param {object} input.gate        completion gate result
 * @param {string} input.assistantText last assistant message text
 * @param {string} [input.messageID] last assistant message id
 * @param {number} [input.cap]       attempts allowed per pending signature
 * @param {number} [input.totalCap]  attempts allowed across the whole loop
 * @returns {{continue: boolean, reason: string, prompt: string|null,
 *            nextAutoLoop: object|null}}
 */
export function planAutoContinuation({
  state,
  gate,
  assistantText,
  messageID = null,
  cap = DEFAULT_AUTO_LOOP_CAP,
  totalCap = DEFAULT_AUTO_LOOP_TOTAL_CAP,
} = {}) {
  if (!gate?.blocked) {
    return { continue: false, reason: "gate-open", prompt: null, nextAutoLoop: null };
  }
  if (!isCompletionClaim(assistantText)) {
    return { continue: false, reason: "no-completion-claim", prompt: null, nextAutoLoop: null };
  }

  const signature = pendingSignature(gate);
  const previous = state?.autoLoop || {};
  const sameSignature = previous.signature === signature;
  const attempts = sameSignature ? Number(previous.attempts) || 0 : 0;
  const total = Number(previous.total) || 0;

  if (messageID && previous.lastMessageID === messageID) {
    return { continue: false, reason: "already-triggered", prompt: null, nextAutoLoop: null };
  }
  if (attempts >= cap) {
    return {
      continue: false,
      reason: "loop-budget-exhausted",
      prompt: null,
      nextAutoLoop: { ...previous, signature, attempts, total, lastMessageID: messageID, exhausted: true },
    };
  }
  if (total >= totalCap) {
    return {
      continue: false,
      reason: "total-budget-exhausted",
      prompt: null,
      nextAutoLoop: { ...previous, signature, attempts, total, lastMessageID: messageID, exhausted: true },
    };
  }

  const nextAttempt = attempts + 1;
  const nextTotal = total + 1;
  const pending = Array.isArray(gate.pending) ? gate.pending : [];
  const lines = [
    "Listo, continúa. [auto-loop] La revisión post-DONE encontró trabajo pendiente. Seguí hasta que el gate no encuentre nada más para corregir.",
    `Intento automático ${nextAttempt}/${cap} para este conjunto de pendientes.`,
    ...pending.map((p) => `- ${p}`),
  ];
  return {
    continue: true,
    reason: "continue",
    prompt: lines.join("\n"),
    nextAutoLoop: {
      signature,
      attempts: nextAttempt,
      total: nextTotal,
      lastMessageID: messageID,
      exhausted: false,
    },
  };
}
