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
 * - "STUCK"         — same (tool,input) key repeated consecutively >= streakThreshold
 *                      without any intervening state change (loop breaker)
 * - "ABORT"         — hard step cap reached (steps >= hardStepCap); immediate stop,
 *                      no further tool calls permitted this session
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
 * @param {number} [options.hardStepCap=150]       — hard session step cap; ABORT when exceeded
 * @param {number} [options.perToolThreshold=3]    — identical-invocation threshold per (tool,input) key
 * @param {number} [options.streakThreshold=3]     — consecutive identical invocations w/o state change → STUCK
 * @param {number} [options.windowSize=50]         — max invocations tracked per key (sliding window)
 * @param {function} [options.now=Date.now]        — injectable clock (determinism)
 * @returns {{ record, noteStateChange, snapshot, restore }}
 */
export function createLoopBudgetGuard(options = {}) {
  const {
    stepBudget = 120,
    hardStepCap = 150,
    perToolThreshold = 3,
    streakThreshold = 3,
    windowSize = 50,
    now = Date.now,
  } = options;
  let steps = 0;
  // Per-key FIFO of invocation timestamps, capped at `windowSize` entries.
  const windows = new Map();
  // Consecutive-run counter for the most recent (tool,input) key. Reset on
  // state change or when the key changes. Used to detect STUCK (no progress).
  let lastKey = null;
  let streak = 0;

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

    // Consecutive-run tracking: same key as the immediately preceding call,
    // with no intervening state change, increments the streak. Any key
    // change resets it. This is the "stuck" signal — the agent is repeating
    // the exact same action with no observable progress.
    if (key === lastKey) {
      streak += 1;
    } else {
      lastKey = key;
      streak = 1;
    }

    const hardCapReached = steps >= hardStepCap;
    const budgetExhausted = steps >= stepBudget;
    const stuck = streak >= streakThreshold;
    let directive = null;
    if (hardCapReached) {
      directive = "ABORT";
    } else if (budgetExhausted) {
      directive = "STOP_CHECKPOINT";
    } else if (stuck) {
      directive = "STUCK";
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
      streak,
      stuck,
      hardCapReached,
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
      lastKey = null;
      streak = 0;
      return;
    }
    const prefix = `${tool}:`;
    for (const key of [...windows.keys()]) {
      if (key === String(tool) || key.startsWith(prefix)) {
        windows.delete(key);
      }
    }
    // State change means progress was made: reset the consecutive-run
    // tracker so a STUCK signal cannot survive across a real mutation.
    lastKey = null;
    streak = 0;
  }

  function snapshot() {
    return {
      stepBudget,
      hardStepCap,
      perToolThreshold,
      streakThreshold,
      windowSize,
      steps,
      lastKey,
      streak,
      windows: [...windows.entries()].map(([key, window]) => [key, [...window]]),
    };
  }

  function restore(snap) {
    try {
      if (!snap || typeof snap !== "object") return;
      if (Number.isFinite(snap.steps)) steps = snap.steps;
      if (typeof snap.lastKey === "string") lastKey = snap.lastKey;
      if (Number.isFinite(snap.streak)) streak = snap.streak;
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
