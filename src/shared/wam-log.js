/**
 * Runtime console gate for WAM diagnostics.
 *
 * When logging is disabled (config.logging=false / WAM_SILENT=1 /
 * WAM_DISABLE_LOGGING=1), wamLog/wamWarn/wamError become no-ops so the plugin
 * stays quiet. Genuine failures that must always surface belong elsewhere.
 */
let loggingEnabled = true;
let debugEnabled = process.env.WAM_DEBUG === "1" || process.env.WAM_DEBUG === "true" || process.env.WAM_LOG_LEVEL === "debug";

const benchmarkStats = {
  timers: new Map(),
  moduleLoads: [],
  latencies: [],
};

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

export function wamLog(...args) {
  if (loggingEnabled) console.log(...args);
}

export function wamWarn(...args) {
  if (loggingEnabled) console.warn(...args);
}

export function wamError(...args) {
  if (loggingEnabled) console.error(...args);
}

export function wamDebug(...args) {
  if (loggingEnabled && debugEnabled) {
    const timestamp = new Date().toISOString();
    console.log(`[WAM-DEBUG ${timestamp}]`, ...args);
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
