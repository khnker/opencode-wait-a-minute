const usageBySession = new Map();
const MAX_SESSIONS = 500;

export function recordRequestUsage(sessionID, usage) {
  if (!sessionID || !usage) return null;
  const normalized = {
    sessionID,
    at: Date.now(),
    input: usage.input || 0,
    output: usage.output || 0,
    reasoning: usage.reasoning || 0,
    cacheRead: usage.cacheRead || 0,
    cacheWrite: usage.cacheWrite || 0,
    requestTokens: usage.requestTokens || 0,
    messageID: usage.messageID || null,
    cost: usage.cost || 0,
    source: "provider",
  };
  usageBySession.set(sessionID, normalized);
  if (usageBySession.size > MAX_SESSIONS) {
    usageBySession.delete(usageBySession.keys().next().value);
  }
  return normalized;
}

export function getRequestUsage(sessionID) {
  if (!sessionID) return null;
  return usageBySession.get(sessionID) || null;
}

export function clearRequestUsage(sessionID) {
  if (sessionID) usageBySession.delete(sessionID);
  else usageBySession.clear();
}

export function requestUsageSize() {
  return usageBySession.size;
}
