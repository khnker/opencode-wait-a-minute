export function createTaskChildRegistry() {
  const promises = new Map();
  const children = new Map();

  return {
    trackPromise(taskId, promise) {
      if (!taskId || !promise) return;
      promises.set(taskId, promise);
    },
    trackChild(taskId, sessionId) {
      if (!taskId || !sessionId) return;
      if (!children.has(taskId)) children.set(taskId, new Set());
      children.get(taskId).add(sessionId);
    },
    hasChildren(taskId) {
      return (children.get(taskId)?.size || 0) > 0 || promises.has(taskId);
    },
    async settle(taskId, { abort } = {}) {
      const aborted = [...(children.get(taskId) || [])];
      for (const sessionId of aborted) {
        try {
          if (typeof abort === "function") await abort(sessionId);
        } catch {}
      }
      const pending = promises.get(taskId);
      let awaited = false;
      if (pending) {
        awaited = true;
        try {
          await pending;
        } catch {}
      }
      children.delete(taskId);
      promises.delete(taskId);
      return { aborted, awaited };
    },
  };
}
