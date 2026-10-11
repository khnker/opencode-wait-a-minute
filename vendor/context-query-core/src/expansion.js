#!/usr/bin/env node
/**
 * engine/expansion.js — deterministic query expansion (PRF + identifier split).
 * No network/LLM; fully deterministic.
 */
import { expandTerms } from './bm25.js';

export function splitIdentifiers(text) {
  if (!text) return [];
  let spaced = String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  spaced = spaced.replace(/[_./\\-]+/g, ' ');
  const tokens = spaced.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  return [...new Set(tokens)];
}

export function expandQuery(query, opts = {}) {
  const { cwd = process.cwd(), queryType = 'default', topK = 5, maxTerms = 5, lambda = 0.6 } = opts;
  if (queryType === 'filename' || queryType === 'exact') {
    return { terms: [], expandedQuery: query, skipped: true, reason: 'ablation' };
  }
  const prfTerms = expandTerms(cwd, query, { topK, maxTerms });
  const idTerms = splitIdentifiers(query).filter(t => {
    const queryWords = String(query).toLowerCase().split(/[^a-z0-9]+/);
    return !queryWords.includes(t);
  });
  const merged = [...new Set([...prfTerms, ...idTerms])].slice(0, maxTerms);
  const expandedQuery = merged.length ? `${query} ${merged.join(' ')}` : query;
  return { terms: merged, expandedQuery, skipped: false, lambda };
}
