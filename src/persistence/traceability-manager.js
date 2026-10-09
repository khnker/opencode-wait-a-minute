import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Logs a trace message for a given task.
 * @param {string} taskId
 * @param {string} rootDir
 * @param {string} message
 */
export async function logTrace(taskId, rootDir, message) {
  const dir = path.join(rootDir, taskId, 'traces');
  await fs.mkdir(dir, { recursive: true });
  const logFilePath = path.join(dir, 'trace.log');
  const timestamp = new Date().toISOString();
  await fs.appendFile(logFilePath, `[${timestamp}] ${message}\n`);
}
