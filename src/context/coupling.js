import { traceCrossLayer } from '../../vendor/context-query-core/src/index.js';

export function detectCouplingIntent(text) {
  const q = text.toLowerCase();
  const hasIntent = /\b(acoplamiento|coupling|cross-layer|endpoint-trace)\b/.test(q);
  const hasAction = /\b(trace|track|map|show|find|analyze)\b/.test(q);
  const hasPathOrUrl = /[\/\\].+|http/i.test(q);
  return hasIntent && hasAction && hasPathOrUrl;
}

export async function traceCouplingForTask(task, { root, depth = 4 } = {}) {
  try {
    const urlMatch = task.match(/(https?:\/\/[^\s]+|[\w\-\.\/]+\.[\w\-\.]+)/);
    const start = urlMatch ? urlMatch[0] : undefined;

    if (!start) {
      return { ok: false, lines: [], result: null };
    }

    const result = await traceCrossLayer({
      repoRoot: root || process.cwd(),
      start,
      depth,
    });

    if (!result || result.length === 0) {
      // Even if empty, return ok: true with empty lines or fallback to ensure robust behavior
      return { ok: true, lines: [], result: [] };
    }

    const lines = result.slice(0, 20).map(r => JSON.stringify(r));
    return { ok: true, lines, result };
  } catch (e) {
    return { ok: false, lines: [], result: null };
  }
}
