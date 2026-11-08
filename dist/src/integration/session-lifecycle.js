/**
 * Session lifecycle registry: keeps WAM session maps in sync with opencode's
 * session.created / session.deleted events. Pure bookkeeping, no I/O beyond
 * the optional callbacks supplied by the caller.
 */

/**
 * Register a session, idempotently.
 * @param {object} options
 * @param {string} [options.sessionID]
 * @param {string|null} [options.directory]
 * @param {object} [options.info]
 * @param {object} options.maps
 * @param {(root: string) => void} [options.ensureRoot]
 * @returns {{ registered: boolean, root?: string|null, reason?: string }}
 */
export function registerSessionLifecycle({ sessionID, directory, info = {}, maps, ensureRoot } = {}) {
  if (!sessionID) return { registered: false, reason: "missing-session-id" };
  const { sessionRoots, sessionWamRoots, sessionParents, sessionTitles, sessionResolved } = maps;
  const already = sessionRoots.has(sessionID) || sessionWamRoots.has(sessionID);
  const root = directory || sessionRoots.get(sessionID) || null;
  if (root) {
    sessionRoots.set(sessionID, root);
    sessionWamRoots.set(sessionID, root);
  }
  if (info.parentID) sessionParents.set(sessionID, info.parentID);
  if (info.title) sessionTitles.set(sessionID, info.title);
  sessionResolved.add(sessionID);
  if (root && typeof ensureRoot === "function") ensureRoot(root);
  return { registered: !already, root };
}

/**
 * Unregister a session and clear all bookkeeping for it.
 * @param {object} options
 * @param {string} [options.sessionID]
 * @param {object} options.maps
 * @param {(event: { sessionID: string, root: string }) => void} [options.removeSessionState]
 * @param {(event: { sessionId: string }) => void} [options.closeSession]
 * @returns {{ removed: boolean }}
 */
export function unregisterSessionLifecycle({ sessionID, maps, removeSessionState, closeSession } = {}) {
  if (!sessionID) return { removed: false };
  const { sessionRoots, sessionWamRoots, sessionParents, sessionTitles, sessionResolved } = maps;
  const root = sessionWamRoots.get(sessionID) || sessionRoots.get(sessionID) || null;
  const hadRoot = sessionRoots.delete(sessionID);
  const hadWamRoot = sessionWamRoots.delete(sessionID);
  sessionParents.delete(sessionID);
  sessionTitles.delete(sessionID);
  const hadResolved = sessionResolved.delete(sessionID);
  if (root && typeof removeSessionState === "function") removeSessionState({ sessionID, root });
  if (typeof closeSession === "function") closeSession({ sessionId: sessionID });
  return { removed: hadRoot || hadWamRoot || hadResolved };
}
