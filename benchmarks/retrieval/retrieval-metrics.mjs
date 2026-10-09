// benchmarks/retrieval/retrieval-metrics.mjs
/**
 * Retrieval evaluation metrics for A/B comparison.
 * Pure functions with unit-testable inputs.
 */

import { mean, stddev } from '../evaluation/statistics.mjs';

/**
 * @typedef {Object} RetrievedItem
 * @property {string} path - Filesystem path relative to repoRoot.
 * @property {string} content - Line content or snippet.
 * @property {number} startLine - Line number (1-indexed).
 * @property {number} score - Relevance score (0-1).
 */

/**
 * @typedef {Object} RelevantItem
 * @property {string} path - Expected file path.
 * @property {string} [mustContain] - Optional substring that must appear in retrieved content.
 */

/**
 * Precision at K: proportion of retrieved items that are relevant among top K.
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items (by relevance).
 * @param {RelevantItem[]} relevant - Ground truth relevant items.
 * @param {number} k - Cutoff position (use all if k > retrieved.length).
 * @returns {number} Precision at K (0-1).
 */
export function precisionAtK(retrieved, relevant, k) {
  const effectiveK = Math.min(k, retrieved.length);
  if (effectiveK === 0) return 0;

  let relevantCount = 0;
  for (let i = 0; i < effectiveK; i++) {
    const r = retrieved[i];
    const isRelevant = relevant.some(rel => {
      const match = r.path === rel.path;
      if (!match) return false;
      if (rel.mustContain && !r.content.includes(rel.mustContain)) return false;
      return true;
    });
    if (isRelevant) relevantCount++;
  }

  return relevantCount / effectiveK;
}

/**
 * Token count for a list of retrieved items.
 * Prefers an explicit `tokenEstimate` (CQE engine accounting) and falls back
 * to a conservative 4-chars-per-token estimate of the snippet content.
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items.
 * @returns {number} Estimated token count.
 */
export function tokensOf(retrieved) {
  let total = 0;
  for (const r of retrieved) {
    if (typeof r.tokenEstimate === 'number' && r.tokenEstimate >= 0) {
      total += r.tokenEstimate;
    } else {
      total += Math.ceil((r.content?.length ?? 0) / 4);
    }
  }
  return total;
}

/**
 * Token count estimate for retrieved items (content-only, characters/4).
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items.
 * @returns {number} Estimated token count.
 */
export function estimateTokens(retrieved) {
  let total = 0;
  for (const r of retrieved) {
    total += Math.ceil((r.content?.length ?? 0) / 4);
  }
  return total;
}

/**
 * Token savings: difference between baseline and CQE retrieval.
 * @param {Array<{armA: number, armB: number}>} perQueryResults - Per-query token counts.
 * @returns {Object} - savings in tokens and percentage.
 */
export function computeTokenSavings(perQueryResults) {
  const totalA = perQueryResults.reduce((acc, q) => acc + q.armA, 0);
  const totalB = perQueryResults.reduce((acc, q) => acc + q.armB, 0);
  const saved = totalA - totalB;
  const savingsPercent = totalA > 0 ? (saved / totalA) * 100 : 0;
  return {
    totalBaselineTokens: totalA,
    totalCQETokens: totalB,
    tokensSaved: saved,
    savingsPercent: Math.round(savingsPercent * 100) / 100,
    totalQueries: perQueryResults.length
  };
}

/**
 * Recall at K: proportion of relevant items retrieved among top K (approximate).
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items (by relevance).
 * @param {RelevantItem[]} relevant - Ground truth relevant items.
 * @param {number} k - Cutoff position (use all if k > retrieved.length).
 * @returns {number} Recall at K (0-1). Uses max(topK, retrieved) for denominator.
 */
export function recallAtK(retrieved, relevant, k) {
  const effectiveK = Math.min(k, retrieved.length);
  const retrievedSet = new Set();
  for (let i = 0; i < effectiveK; i++) {
    const r = retrieved[i];
    retrievedSet.add(r.path);
  }

  let relevantCount = 0;
  for (const rel of relevant) {
    if (retrievedSet.has(rel.path)) {
      if (!rel.mustContain) {
        relevantCount++;
      } else {
        for (let i = 0; i < effectiveK; i++) {
          const r = retrieved[i];
          if (r.path === rel.path && r.content.includes(rel.mustContain)) {
            relevantCount++;
            break;
          }
        }
      }
    }
  }

  return relevantCount / (relevant.length || 1);
}

/**
 * Mean Reciprocal Rank (MRR): average of 1/rank for the first relevant item per query.
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items (by relevance).
 * @param {RelevantItem[]} relevant - Ground truth relevant items.
 * @returns {number} MRR (0-1).
 */
export function mrr(retrieved, relevant) {
  if (relevant.length === 0) return 0;
  for (let i = 0; i < retrieved.length; i++) {
    const r = retrieved[i];
    for (const rel of relevant) {
      if (r.path === rel.path) {
        if (!rel.mustContain || r.content.includes(rel.mustContain)) {
          return 1 / (i + 1);
        }
      }
    }
  }
  return 0;
}

/**
 * Normalized Discounted Cumulative Gain at K.
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items (by relevance score).
 * @param {RelevantItem[]} relevant - Ground truth relevant items.
 * @param {number} k - Cutoff position.
 * @returns {number} NDCG at K (0-1).
 */
export function ndcgAtK(retrieved, relevant, k) {
  const effectiveK = Math.min(k, retrieved.length);
  if (effectiveK === 0) return 0;

  // DCG: sum over i of (rel_i / log2(i+1))
  let dcg = 0;
  for (let i = 0; i < effectiveK; i++) {
    const r = retrieved[i];
    let relevance = 0;
    for (const rel of relevant) {
      if (r.path === rel.path && (!rel.mustContain || r.content.includes(rel.mustContain))) {
        relevance = 1;
        break;
      }
    }
    dcg += relevance / Math.log2(i + 2);
  }

  // IDCG: DCG assuming perfect ranking (all relevant items first, then non-relevant)
  const relevantCount = relevant.length;
  const nonRelevant = Math.max(0, effectiveK - relevantCount);
  let idcg = 0;
  for (let i = 0; i < relevantCount; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  for (let i = relevantCount; i < effectiveK; i++) {
    idcg += 0 / Math.log2(i + 2); // zeros
  }

  if (idcg === 0) return 0;
  return dcg / idcg;
}

/**
 * Coverage: proportion of relevant items that appear anywhere in retrieved set.
 * @param {RetrievedItem[]} retrieved - Ordered list of retrieved items (by relevance).
 * @param {RelevantItem[]} relevant - Ground truth relevant items.
 * @returns {number} Coverage (0-1).
 */
export function coverage(retrieved, relevant) {
  if (relevant.length === 0) return 1;

  const retrievedPaths = new Set(retrieved.map(r => r.path));
  let covered = 0;
  for (const rel of relevant) {
    if (!rel.mustContain) {
      if (retrievedPaths.has(rel.path)) covered++;
    } else {
      for (const r of retrieved) {
        if (r.path === rel.path && r.content.includes(rel.mustContain)) {
          covered++;
          break;
        }
      }
    }
  }

  return covered / relevant.length;
}

/**
 * Empty Rate: proportion of queries that yielded zero retrieved items.
 * @param {RetrievedItem[][]} perQueryRetrieved - Array of per-query retrieved item lists.
 * @returns {number} Empty rate (0-1).
 */
export function emptyRate(perQueryRetrieved) {
  if (perQueryRetrieved.length === 0) return 0;
  let emptyCount = 0;
  for (const retrieved of perQueryRetrieved) {
    if (!Array.isArray(retrieved) || retrieved.length === 0) emptyCount++;
  }
  return emptyCount / perQueryRetrieved.length;
}

/**
 * Dedup Rate: proportion of duplicate paths (by startLine) among retrieved items.
 * @param {RetrievedItem[][]} perQueryRetrieved - Array of per-query retrieved item lists.
 * @returns {number} Dedup rate (0-1).
 */
export function dedupRate(perQueryRetrieved) {
  if (perQueryRetrieved.length === 0) return 1;

  let totalItems = 0;
  let uniqueItems = 0;
  for (const retrieved of perQueryRetrieved) {
    const seen = new Set();
    for (const item of retrieved) {
      totalItems++;
      const key = `${item.path}:${item.startLine}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems++;
      }
    }
  }

  return totalItems === 0 ? 1 : uniqueItems / totalItems;
}

/**
 * Compute all metrics for a single query.
 * @param {RetrievedItem[]} retrieved - Retrieved items for this query.
 * @param {RelevantItem[]} relevant - Ground truth relevant items for this query.
 * @param {number} k - Cutoff for precision/recall/ndcg.
 * @returns {Object} Metric values.
 */
export function computeQueryMetrics(retrieved, relevant, k) {
  return {
    precision: precisionAtK(retrieved, relevant, k),
    recall: recallAtK(retrieved, relevant, k),
    mrr: mrr(retrieved, relevant),
    ndcg: ndcgAtK(retrieved, relevant, k),
    coverage: coverage(retrieved, relevant),
  };
}

/**
 * Compute aggregate metrics across all queries.
 * @param {RetrievedItem[][]} perQueryRetrieved - Array of per-query retrieved item lists.
 * @param {RelevantItem[][]} perQueryRelevant - Array of per-query relevant item lists.
 * @param {number} k - Cutoff for precision/recall/ndcg.
 * @returns {Object} Aggregate metrics (mean, stddev).
 */
export function computeArmMetrics(perQueryRetrieved, perQueryRelevant, k) {
  const metricsList = perQueryRetrieved.map((retrieved, idx) => {
    const relevant = perQueryRelevant[idx] || [];
    return computeQueryMetrics(retrieved, relevant, k);
  });

  const aggregate = {};
  const metricNames = ['precision', 'recall', 'mrr', 'ndcg', 'coverage'];

  for (const name of metricNames) {
    const values = metricsList.map(m => m[name]);
    aggregate[`${name}Mean`] = mean(values);
    aggregate[`${name}StdDev`] = stddev(values);
  }

  aggregate.emptyRate = emptyRate(perQueryRetrieved);
  aggregate.dedupRate = dedupRate(perQueryRetrieved);

  return aggregate;
}
