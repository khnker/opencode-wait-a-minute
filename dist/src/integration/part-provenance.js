/**
 * Provenance tracking for synthetic parts injected by WaitAMinute.
 * Prevents re-entrancy and self-consumption bugs.
 *
 * This module is also the single enforcement point of OpenCode's user-part
 * contract: a part returned from the `chat.message` hook without an `id` makes
 * OpenCode reject the whole prompt ("invalid user part before save",
 * SchemaError: Missing key at ["id"]) and the session stops advancing. Every
 * part leaving this module is either valid or dropped with a warning.
 */
import { randomBytes } from "node:crypto";

export const WAM_META = "wam";
// OpenCode valida PartID como "string que empieza con prt" (qc("prt") → startsWith);
// el guion bajo es la convención de generación, no un requisito del esquema.
export const PART_ID_PREFIX = "prt_";
const OPENCODE_PART_ID_PREFIX = "prt";

/**
 * Generates a part id in the shape OpenCode expects (prt_ + 16 hex chars).
 */
export function defaultPartId() {
  return PART_ID_PREFIX + randomBytes(8).toString("hex");
}

function normalizePartInput(part) {
  if (typeof part === "string") return { type: "text", text: part };
  if (part && typeof part === "object" && !Array.isArray(part)) return part;
  return { type: "text" };
}

/**
 * Tags a part as synthetic and injected by WAM.
 *
 * The id is not opt-in: a caller-provided id is preserved, otherwise the
 * factory (default `defaultPartId`) fills it. `sessionID`/`messageID` are
 * filled from the injection context only when the part does not carry them.
 *
 * @param {Object|string} part
 * @param {Object} [options]
 * @param {string} [options.messageID]
 * @param {string} [options.sessionID]
 * @param {string} [options.phase]
 * @param {Function} [options.idFactory]
 * @param {boolean} [options.synthetic]
 */
export function tagWamPart(part, { messageID, sessionID, phase, idFactory = defaultPartId, synthetic = true } = {}) {
  const source = normalizePartInput(part);
  const providedId = typeof source.id === "string" && source.id.length > 0 ? source.id : null;
  const factory = typeof idFactory === "function" ? idFactory : defaultPartId;
  return {
    ...source,
    id: providedId ?? factory() ?? defaultPartId(),
    type: source.type || "text",
    ...(sessionID && !source.sessionID ? { sessionID } : {}),
    ...(messageID && !source.messageID ? { messageID } : {}),
    synthetic: typeof synthetic === "boolean" ? synthetic : true,
    metadata: {
      ...(source.metadata || {}),
      [WAM_META]: true,
      wamMessageId: messageID ?? null,
      wamPhase: phase ?? null,
    },
  };
}

/**
 * Validates a part against OpenCode's persisted user-part contract.
 * Pure predicate: never throws, never mutates.
 *
 * @param {Object} part
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateWamPart(part) {
  if (!part || typeof part !== "object" || Array.isArray(part)) {
    return { valid: false, errors: ["part is not an object"] };
  }
  const errors = [];
  if (typeof part.id !== "string" || !part.id.startsWith(OPENCODE_PART_ID_PREFIX)) {
    errors.push(`id must be a string starting with ${OPENCODE_PART_ID_PREFIX}`);
  }
  if (typeof part.type !== "string" || part.type.length === 0) {
    errors.push("type must be a non-empty string");
  }
  if (part.type === "text" && (typeof part.text !== "string" || part.text.length === 0)) {
    errors.push("text part requires non-empty text");
  }
  if (part.sessionID != null && (typeof part.sessionID !== "string" || part.sessionID.length === 0)) {
    errors.push("sessionID must be a non-empty string when present");
  }
  if (part.messageID != null && (typeof part.messageID !== "string" || part.messageID.length === 0)) {
    errors.push("messageID must be a non-empty string when present");
  }
  if (part.synthetic != null && typeof part.synthetic !== "boolean") {
    errors.push("synthetic must be a boolean when present");
  }
  return { valid: errors.length === 0, errors };
}

function uniquePartId(usedIds, idFactory) {
  const factory = typeof idFactory === "function" ? idFactory : defaultPartId;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = factory();
    if (typeof candidate === "string" && candidate.length > 0 && !usedIds.has(candidate)) {
      return candidate;
    }
  }
  let fallback = defaultPartId();
  while (usedIds.has(fallback)) fallback = defaultPartId();
  return fallback;
}

/**
 * Checks if a part was injected by WAM.
 */
export function isWamSynthetic(part) {
  return !!part && part?.metadata?.[WAM_META] === true;
}

/**
 * Checks if a collection of parts contains a marker for a specific messageID.
 */
export function hasWamMarkerFor(parts, messageID) {
  return Array.isArray(parts) && parts.some(p => isWamSynthetic(p) && (messageID == null || p.metadata?.wamMessageId === messageID));
}

/**
 * Resolves the array that receives injected parts.
 * Supports every shape OpenCode uses for the chat.message output:
 *   { parts } | { system } | { message: { parts } } | { message: { system } }.
 * Ponytail: without the nested shapes the injection was silently dropped and
 * the warning/validation never reached the LLM.
 * @param {Object} target
 * @returns {Array|null}
 */
export function resolveInjectionSink(target) {
  if (!target) return null;
  if (Array.isArray(target.parts)) return target.parts;
  if (Array.isArray(target.system)) return target.system;
  if (Array.isArray(target.message?.parts)) return target.message.parts;
  if (Array.isArray(target.message?.system)) return target.message.system;
  return null;
}

/**
 * Injects WAM parts into a target sink (parts array, system array, or the
 * nested message.parts / message.system shapes), enforcing the part contract:
 * every accepted part has a unique id and passes `validateWamPart`; invalid
 * parts are dropped and warned about instead of failing the whole prompt.
 *
 * @param {Object} target
 * @param {string|Object|Array<string|Object>} textsOrParts
 * @param {Object} [options]
 * @returns {{inserted: number, dropped: number}}
 */
export function injectWamParts(target, textsOrParts, { messageID, sessionID, phase, idFactory = defaultPartId, position = "prepend", synthetic } = {}) {
  const sink = resolveInjectionSink(target);
  if (!sink) return { inserted: 0, dropped: 0 };

  const list = Array.isArray(textsOrParts) ? textsOrParts : [textsOrParts];
  const usedIds = new Set(sink.map((p) => p?.id).filter((id) => typeof id === "string" && id.length > 0));
  const accepted = [];
  const rejected = [];

  for (const item of list) {
    const tagged = tagWamPart(item, { messageID, sessionID, phase, idFactory, synthetic });
    if (usedIds.has(tagged.id)) tagged.id = uniquePartId(usedIds, idFactory);
    const { valid, errors } = validateWamPart(tagged);
    if (!valid) {
      rejected.push({ errors, text: typeof tagged.text === "string" ? tagged.text.slice(0, 80) : null });
      continue;
    }
    usedIds.add(tagged.id);
    accepted.push(tagged);
  }

  if (rejected.length > 0) {
    console.warn(`[wait-a-minute] dropped ${rejected.length} invalid synthetic part(s)`, rejected);
  }
  if (accepted.length > 0) {
    if (position === "append") sink.push(...accepted);
    else sink.unshift(...accepted);
  }
  return { inserted: accepted.length, dropped: rejected.length };
}
