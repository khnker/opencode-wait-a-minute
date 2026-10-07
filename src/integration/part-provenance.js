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
export function tagWamPart(part, { messageID, phase, idFactory } = {}) {
  const tagged = {
    ...part,
    synthetic: true,
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
  return !!part && part.synthetic === true && part?.metadata?.[WAM_META] === true;
}

/**
 * Checks if a collection of parts contains a marker for a specific messageID.
 */
export function hasWamMarkerFor(parts, messageID) {
  return Array.isArray(parts) && parts.some(p => isWamSynthetic(p) && (messageID == null || p.metadata?.wamMessageId === messageID));
}

/**
 * Injects WAM parts into a target sink (parts array or system array).
 */
export function injectWamParts(target, textsOrParts, { messageID, phase, idFactory, position = "prepend" } = {}) {
  const sink = Array.isArray(target.parts) ? target.parts : (Array.isArray(target.system) ? target.system : null);
  if (!sink) return;

  const list = Array.isArray(textsOrParts) ? textsOrParts : [textsOrParts];
  const parts = list.map(item => {
    const part = typeof item === "string" ? { type: "text", text: item } : item;
    return tagWamPart(part, { messageID, phase, idFactory });
  });

  if (position === "append") {
    sink.push(...parts);
  } else {
    sink.unshift(...parts);
  }
}
