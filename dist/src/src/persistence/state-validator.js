/**
 * StateValidator.js
 * Validates WAM session state structures and performs health checks.
 */

export const StateValidator = {
  /**
   * Validates a WAM state object.
   * @param {object} state
   * @throws {Error} if invalid
   */
  validate(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('Invalid state: not an object');
    }
    if (!state.taskId) {
      throw new Error('Invalid state: missing taskId');
    }
    if (state.status === null) {
      throw new Error('Invalid state: missing status');
    }
    // Add more validation logic as needed
  },

  /**
   * Performs health check and recovery logic for a state.
   * Gracefully handles legacy or degraded states with warnings instead of throwing.
   * @param {any} state
   * @returns {any} validated and potentially fixed state
   */
  processState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return state;
    }

    try {
      this.validate(state);
    } catch (err) {
      console.warn(`[StateValidator] Warning: legacy or degraded state encountered: ${err.message}. Attempting migration/recovery.`);
      if (!state.taskId) {
        state.taskId = state.id || 'unknown';
      }
      if (state.status === null) {
        state.status = 'unknown';
      }
    }

    // Detect orphaned tasks (IN_PROGRESS > 1 hour)
    if (state.status === 'IN_PROGRESS' && state.updatedAt) {
      const updatedAt = new Date(state.updatedAt).getTime();
      const now = Date.now();
      const oneHourInMs = 60 * 60 * 1000;

      if (!isNaN(updatedAt) && now - updatedAt > oneHourInMs) {
        state.status = 'ORPHANED_RECOVERY';
        state.updatedAt = new Date().toISOString();
        state.recoveryReason = 'Timeout: task IN_PROGRESS for more than 1 hour';
      }
    }

    return state;
  }
};
