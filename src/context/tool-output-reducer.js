/**
 * Tool output reducer.
 *
 * Stores the raw output under .wam/tool-output/<taskId>/ and replaces the
 * in-context output with a bounded head/tail/error summary.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const MAX_TOOL_OUTPUT_CHARS = 2000;
export const MAX_RAW_FILES = 200;
export const MAX_RAW_BYTES = 50 * 1024 * 1024;

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function pruneRawStore(dir) {
  try {
    const files = fs
      .readdirSync(dir)
      .map((name) => {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        return { full, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a, b) => a.mtime - b.mtime);
    let total = files.reduce((sum, f) => sum + f.size, 0);
    while (files.length > MAX_RAW_FILES || total > MAX_RAW_BYTES) {
      const oldest = files.shift();
      if (!oldest) break;
      total -= oldest.size;
      try { fs.rmSync(oldest.full, { force: true }); } catch {}
    }
  } catch {}
}

function pickErrorLines(text, limit = 8) {
  return text
    .split("\n")
    .filter((line) => /error|fail|exception|traceback|fatal|cannot|denied/i.test(line))
    .slice(0, limit);
}

export function summarizeToolOutput(text, { toolName = "tool", maxChars = MAX_TOOL_OUTPUT_CHARS } = {}) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;

  const headerBudget = 200;
  const tailBudget = 800;
  const errorLines = pickErrorLines(value);
  const errorBudget = Math.min(600, errorLines.join("\n").length);
  const headBudget = Math.max(200, maxChars - headerBudget - tailBudget - errorBudget - 200);

  const head = value.slice(0, headBudget);
  const tail = value.slice(-tailBudget);
  const parts = [
    `[${toolName} output reduced: ${value.length} chars]`,
    head.trim(),
    ...(errorLines.length ? ["--- errors ---", ...errorLines] : []),
    "--- tail ---",
    tail.trim(),
  ];
  return parts.join("\n").slice(0, maxChars);
}

/**
 * @param {{ toolName?: string, text?: string, root?: string, taskId?: string, maxChars?: number }} input
 */
export function reduceToolOutput(input = {}) {
  const text = typeof input.text === "string" ? input.text : "";
  const maxChars = input.maxChars ?? MAX_TOOL_OUTPUT_CHARS;
  if (text.length <= maxChars) {
    return {
      changed: false,
      text,
      tokensBefore: estimateTokens(text),
      tokensAfter: estimateTokens(text),
      savedTokens: 0,
      rawPath: null,
    };
  }

  const root = input.root || process.cwd();
  const taskId = String(input.taskId || "default").replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(root, ".wam", "tool-output", taskId);
  fs.mkdirSync(dir, { recursive: true });
  const rawPath = path.join(dir, `${hash(text)}.txt`);
  if (!fs.existsSync(rawPath)) fs.writeFileSync(rawPath, text, "utf8");
  pruneRawStore(dir);

  const summary = summarizeToolOutput(text, { toolName: input.toolName, maxChars });
  const display = `${summary}\n\n[raw output: ${path.relative(root, rawPath)}]`;
  const tokensBefore = estimateTokens(text);
  const tokensAfter = estimateTokens(display);
  return {
    changed: true,
    text: display,
    tokensBefore,
    tokensAfter,
    savedTokens: Math.max(0, tokensBefore - tokensAfter),
    rawPath,
  };
}
