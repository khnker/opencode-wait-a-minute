/**
 * Runtime console gate for WAM diagnostics.
 *
 * When logging is disabled (config.logging=false / WAM_SILENT=1 /
 * WAM_DISABLE_LOGGING=1), wamLog/wamWarn/wamError become no-ops so the plugin
 * stays quiet. Genuine failures that must always surface belong elsewhere.
 */
let loggingEnabled = true;

export function setLoggingEnabled(enabled) {
  loggingEnabled = enabled !== false;
}

export function isLoggingEnabled() {
  return loggingEnabled;
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
