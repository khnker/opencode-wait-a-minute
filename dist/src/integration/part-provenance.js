/**
 * Provenance tracking for synthetic parts injected by WaitAMinute.
 * Prevents re-entrancy and self-consumption bugs.
 */

export const WAM_META = "wam";

/**
 * Tags a part as synthetic and injected by WAM.
 * @param {Object} part
 * @param {Object} [options]
 * @param {string} [options.messageID]
 * @param {string} [options.phase]
 * @param {Function} [options.idFactory]
 */
export function tagWamPart(part, { messageID, sessionID, phase, idFactory, synthetic = true } = {}) {
  const tagged = {
    ...part,
    ...(sessionID && !part.sessionID ? { sessionID } : {}),
    ...(messageID && !part.messageID ? { messageID } : {}),
    synthetic,
    metadata: {
      ...(part.metadata || {}),
      [WAM_META]: true,
      wamMessageId: messageID ?? null,
      wamPhase: phase ?? null,
    },
  };
  if (idFactory && !tagged.id) {
    tagged.id = idFactory();
  }
  return tagged;
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
 * nested message.parts / message.system shapes).
 */
export function injectWamParts(target, textsOrParts, { messageID, sessionID, phase, idFactory, position = "prepend", synthetic } = {}) {
  const sink = resolveInjectionSink(target);
  if (!sink) return;

  const list = Array.isArray(textsOrParts) ? textsOrParts : [textsOrParts];
  const parts = list.map(item => {
    const part = typeof item === "string" ? { type: "text", text: item } : item;
    return tagWamPart(part, { messageID, sessionID, phase, idFactory, synthetic });
  });

  if (position === "append") {
    sink.push(...parts);
  } else {
    sink.unshift(...parts);
  }
}
