/**
 * Runaway Loop Budget Guard (spec: runaway-loop-budget-guard)
 *
 * Detects repeated identical tool invocations using a normalized
 * (tool, input) key and enforces a per-session step budget.
 *
 * Design invariants:
 * - Deterministic: injectable `now` clock; no randomness, no Date.now() capture.
 * - Fail open: key normalization never throws (falls back to String(tool)).
 * - Never corrupts task state: restore() is defensive and swallows malformed snapshots.
 *
 * Directive semantics (returned by record()):
 * - null            — below threshold, within budget
 * - "CHECKPOINT"    — per-tool repetition reached perToolThreshold (force checkpoint, continue)
 * - "ESCALATE"      — repetition >= perToolThreshold * 2 (well beyond threshold)
 * - "STOP_CHECKPOINT" — session step budget exhausted (steps >= stepBudget)
 */

/**
 * Recursively sort object keys so `{a:1,b:{c:2,d:3}}` and
 * `{b:{d:3,c:2},a:1}` normalize to the exact same string.
 * Throws on circular structures — callers must handle that (fail open).
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * @param {object} [options]
 * @param {number} [options.stepBudget=120]        — session step budget
 * @param {number} [options.perToolThreshold=3]    — identical-invocation threshold per (tool,input) key
 * @param {number} [options.windowSize=50]         — max invocations tracked per key (sliding window)
 * @param {function} [options.now=Date.now]        — injectable clock (determinism)
 * @returns {{ record, noteStateChange, snapshot, restore }}
 */
export function createLoopBudgetGuard(options = {}) {
  const {
    stepBudget = 120,
    perToolThreshold = 3,
    windowSize = 50,
    now = Date.now,
  } = options;

  let steps = 0;
  // Per-key FIFO of invocation timestamps, capped at `windowSize` entries.
  const windows = new Map();

  function buildKey(tool, input) {
    try {
      return `${tool}:${stableStringify(input)}`;
    } catch {
      // Fail open: unstringifiable input (e.g. circular) still tracks by tool.
      return String(tool);
    }
  }

  function record(tool, input) {
    steps += 1;
    const key = buildKey(tool, input);
    let window = windows.get(key);
    if (!window) {
      window = [];
      windows.set(key, window);
    }
    window.push(now());
    if (window.length > windowSize) window.shift();

    const count = window.length;
    const budgetExhausted = steps >= stepBudget;

    let directive = null;
    if (budgetExhausted) {
      directive = "STOP_CHECKPOINT";
    } else if (count >= perToolThreshold * 2) {
      directive = "ESCALATE";
    } else if (count >= perToolThreshold) {
      directive = "CHECKPOINT";
    }

    return {
      repeated: count >= perToolThreshold,
      count,
      key,
      steps,
      budgetExhausted,
      directive,
    };
  }

  /**
   * Reset repetition counters after an external state change
   * (e.g. file digest changed): all tools, or a single tool when given.
   * Does NOT reset the session step budget (steps persist per session).
   */
  function noteStateChange(tool) {
    if (tool === undefined || tool === null) {
      windows.clear();
      return;
    }
    const prefix = `${tool}:`;
    for (const key of [...windows.keys()]) {
      if (key === String(tool) || key.startsWith(prefix)) {
        windows.delete(key);
      }
    }
  }

  function snapshot() {
    return {
      stepBudget,
      perToolThreshold,
      windowSize,
      steps,
      windows: [...windows.entries()].map(([key, window]) => [key, [...window]]),
    };
  }

  function restore(snap) {
    try {
      if (!snap || typeof snap !== "object") return;
      if (Number.isFinite(snap.steps)) steps = snap.steps;
      if (Array.isArray(snap.windows)) {
        windows.clear();
        for (const [key, window] of snap.windows) {
          if (typeof key === "string" && Array.isArray(window)) {
            windows.set(key, [...window]);
          }
        }
      }
    } catch {
      // Fail open: a malformed snapshot must never throw.
    }
  }

  return { record, noteStateChange, snapshot, restore };
}
