import { tagWamPart, defaultPartId } from "./part-provenance.js";

export const MAX_VISIBLE_NOTICES_PER_SESSION = 5;

export function enqueueVisibleNotice(store, sessionID, text, { max } = {}) {
  if (!store || !sessionID) return false;
  const normalized = String(text ?? "").trim();
  if (!normalized) return false;
  const limit = Number.isFinite(max) && max > 0 ? max : MAX_VISIBLE_NOTICES_PER_SESSION;
  const current = Array.isArray(store.get(sessionID)) ? store.get(sessionID) : [];
  if (current.includes(normalized)) return false;
  const next = [...current, normalized].slice(-limit);
  store.set(sessionID, next);
  return true;
}

export function drainVisibleNotices(store, sessionID) {
  if (!store || !sessionID) return [];
  const notices = Array.isArray(store.get(sessionID)) ? store.get(sessionID) : [];
  store.delete(sessionID);
  return notices;
}

export function buildVisibleNoticePart({ sessionID, messageID, text, idFactory = defaultPartId }) {
  return tagWamPart(
    { id: idFactory(), type: "text", text: String(text) },
    { messageID, sessionID, phase: "visible-notice", idFactory, synthetic: true },
  );
}

export async function updateVisibleNoticePart(client, { sessionID, messageID, part }) {
  const partUpdate = client?.session?.part?.update;
  if (typeof partUpdate === "function") {
    await partUpdate.call(client.session.part, { sessionID, messageID, partID: part.id, part });
    return "part-update";
  }
  const rawClient = client?.session?._client ?? client?._client;
  if (typeof rawClient?.patch === "function") {
    await rawClient.patch({
      url: "/session/{sessionID}/message/{messageID}/part/{partID}",
      path: { sessionID, messageID, partID: part.id },
      body: part,
      headers: { "Content-Type": "application/json" },
    });
    return "raw-patch";
  }
  throw new Error("client.session.part.update no disponible");
}
