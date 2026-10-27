import fs from 'node:fs';
import path from 'node:path';

const LOG_FILE = process.env.WAM_LOG_FILE || path.join(process.cwd(), '.wam', 'plugin.log');
const MAX_LOG_BYTES = Number(process.env.WAM_LOG_MAX_BYTES || 5 * 1024 * 1024);

let loggingEnabled = true;

/** Enable/disable WAM file logging at runtime (driven by WAM config). */
export function configureLogger({ enabled } = {}) {
  if (enabled !== undefined) loggingEnabled = enabled !== false;
}

export function isLoggingEnabled() {
  return loggingEnabled;
}

/**
 * Simple diagnostic logger for wait-a-minute-plugin.
 * Prefixes: [ISO-Timestamp] [LEVEL] [category] Message
 */
export const logger = {
  _log(level, category, message) {
    if (!loggingEnabled) return;
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] [${category}] ${message}\n`;
    
    try {
      const logDir = path.dirname(LOG_FILE);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      try {
        if (fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
          fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
        }
      } catch {}
      fs.appendFileSync(LOG_FILE, formattedMessage, 'utf8');
    } catch (err) {
      console.error(`[LOGGER-ERROR] Failed to write to log file: ${err.message}`);
    }
  },

  info(category, message) {
    this._log('INFO', category, message);
  },

  warn(category, message) {
    this._log('WARN', category, message);
  },

  error(category, message) {
    this._log('ERROR', category, message);
  }
};


