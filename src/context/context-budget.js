/**
 * State-aware context budget.
 *
 * Keeps the injected context bounded by lane/state, dedupes identical items and
 * drops the lowest-value tail once the token budget is exhausted.
 */

export const CONTEXT_BUDGETS = Object.freeze({
  CONVERSATION: { maxItems: 3, maxTokens: 400 },
  CONTINUATION: { maxItems: 6, maxTokens: 1200 },
  TASK_NEW: { maxItems: 10, maxTokens: 2500 },
  CORRECTION: { maxItems: 8, maxTokens: 1800 },
  PROPOSED: { maxItems: 8, maxTokens: 2000 },
  IMPLEMENTING: { maxItems: 10, maxTokens: 2500 },
  VERIFYING: { maxItems: 8, maxTokens: 2000 },
  ASKING: { maxItems: 6, maxTokens: 1200 },
  DONE: { maxItems: 2, maxTokens: 300 },
});

const DEFAULT_BUDGET = { maxItems: 8, maxTokens: 2000 };

export function budgetForState(state) {
  return CONTEXT_BUDGETS[String(state || "").toUpperCase()] || DEFAULT_BUDGET;
}

function tokenCost(item, estimateTokens) {
  const text = typeof item === "string" ? item : item?.text || "";
  if (typeof estimateTokens === "function") return estimateTokens(text);
  return Math.ceil(String(text).length / 4);
}

/**
 * @param {Array<string|{text:string}>} items
 * @param {{ state?: string, estimateTokens?: Function }} [opts]
 */
export function applyContextBudget(items, opts = {}) {
  const budget = budgetForState(opts.state);
  const seen = new Set();
  const kept = [];
  let tokens = 0;

  for (const item of items || []) {
    const text = typeof item === "string" ? item : item?.text || "";
    const normalized = text.trim();
    if (!normalized || seen.has(normalized)) continue;
    const cost = tokenCost(normalized, opts.estimateTokens);
    if (kept.length >= budget.maxItems) break;
    if (tokens + cost > budget.maxTokens) break;
    seen.add(normalized);
    kept.push(item);
    tokens += cost;
  }

  return kept;
}
