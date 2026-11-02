/** Normalizes host session events into WAM's internal shape. */
export function normalizeSessionEvent(event) {
  if (event?.type !== "session.idle") return null;
  const properties = event.properties || {};
  return {
    type: "session.idle",
    sessionId: properties.sessionID ?? properties.sessionId ?? event.sessionID ?? null,
  };
}

export function isSessionIdle(event) {
  return normalizeSessionEvent(event)?.type === "session.idle";
}
