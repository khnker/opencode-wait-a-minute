/**
 * Runtime console gate for WAM diagnostics.
 *
 * When logging is disabled (config.logging=false / WAM_SILENT=1 /
 * WAM_DISABLE_LOGGING=1), wamLog/wamWarn/wamError become no-ops so the plugin
 * stays quiet. Genuine failures that must always surface belong elsewhere.
 *
 * Debug mode (config.debug=true / WAM_DEBUG=1 / WAM_LOG_LEVEL=debug) emits
 * structured [WAM-DEBUG] traces that audit which WAM logic is loaded, which is
 * skipped, and what the runtime decisions were. Each trace carries a category
 * so logs can be grepped, filtered and benchmarked without parsing free-form
 * messages. The benchmarkStats accumulator records module-load and latency
 * samples for offline analysis (see getBenchmarkStats / resetBenchmarkStats).
 */
let loggingEnabled = true;
let debugEnabled = process.env.WAM_DEBUG === "1" ||
  process.env.WAM_DEBUG === "true" ||
  process.env.WAM_LOG_LEVEL === "debug";

const benchmarkStats = {
  timers: new Map(),
  moduleLoads: [],
  latencies: [],
};

// Registry of WAM logic gates that can be audited at runtime.
// Each entry records whether the gate is loaded, its source and a note.
const logicGates = new Map();

export function setLoggingEnabled(enabled) {
  loggingEnabled = enabled !== false;
}

export function isLoggingEnabled() {
  return loggingEnabled;
}

export function setDebugEnabled(enabled) {
  debugEnabled = enabled === true;
}

export function isDebugEnabled() {
  return debugEnabled;
}

/** Register (or update) a WAM logic gate so it can be audited. */
export function registerLogicGate(name, { loaded = true, source = "", note = "" } = {}) {
  const record = {
    name,
    loaded: loaded === true,
    source: String(source || ""),
    note: String(note || ""),
    timestamp: Date.now(),
  };
  logicGates.set(name, record);
  if (loggingEnabled && debugEnabled) {
    console.log(`[WAM-LOGIC-GATE] '${name}' -> loaded=${record.loaded} source='${record.source}'`);
  }
  return record;
}

/** Return a snapshot of every registered logic gate. */
export function getLogicGates() {
  return Array.from(logicGates.values());
}

/** Reset the logic-gate registry (useful between test runs). */
export function resetLogicGates() {
  logicGates.clear();
}

export function wamLog(...args) {
  if (loggingEnabled) console.log(...args);
}

export function wamWarn(...args) {
  if (loggingEnabled) console.warn(...args);
}

export function wamError(...args) {
  if (loggingEnabled) console.error(...args);
}

/**
 * Structured debug trace.
 * @param {string} category - stable id used to grep/filter traces (e.g. "skills", "governance")
 * @param {string} message
 * @param {object} [details]
 */
export function wamDebug(category, message, details = {}) {
  if (loggingEnabled && debugEnabled) {
    const timestamp = new Date().toISOString();
    console.log(`[WAM-DEBUG ${timestamp}] [${category}] ${message}`, details);
  }
}

export function wamAuditModuleLoad(moduleName, status, details = {}) {
  const record = { moduleName, status, details, timestamp: Date.now() };
  benchmarkStats.moduleLoads.push(record);
  if (loggingEnabled && debugEnabled) {
    console.log(`[WAM-MODULE-AUDIT] Module '${moduleName}' -> STATUS: ${status}`, details);
  }
  return record;
}

export function wamStartTimer(label, metadata = {}) {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    end(additionalMeta = {}) {
      const end = typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = Number((end - start).toFixed(3));
      const record = { label, durationMs, metadata: { ...metadata, ...additionalMeta }, timestamp: Date.now() };
      benchmarkStats.latencies.push(record);
      if (loggingEnabled && debugEnabled) {
        console.log(`[WAM-BENCHMARK] '${label}' took ${durationMs}ms`, record.metadata);
      }
      return durationMs;
    },
  };
}

export function getBenchmarkStats() {
  return {
    moduleLoads: [...benchmarkStats.moduleLoads],
    latencies: [...benchmarkStats.latencies],
  };
}

export function resetBenchmarkStats() {
  benchmarkStats.moduleLoads = [];
  benchmarkStats.latencies = [];
}