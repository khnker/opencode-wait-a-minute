/**
 * engine/retriever.js — Retriever interface + implementations (task CQE-1).
 *
 * The Retriever abstracts away different search strategies (lexical, structural,
 * semantic, symbol lookup). Each retriever implements `retrieve(query, opts)`
 * and returns a standardized Candidate[] that the optimizer + reranker can process.
 *
 * Candidate shape:
 *   { id, path, line_start, line_end, score, source, match_type, snippet }
 *
 * Retrievers can be combined via hybrid retrieval (parallel execution, then
 * reranking). The design intentionally avoids a single embedding-based approach
 * in favor of hybrid lexical + semantic + structural signals (see CQE phases 1–3).
 */

import { score as bm25Score } from './bm25.js';
import { symbolLookup, ensureIndex } from './index-ops.js';
import { rrfFuse } from './rrf.js';
import { selectMMR } from './selector.js';
import { parseName } from './decompose.js';
import { expandQuery } from './expansion.js';
import { structuralRefine } from './structural-refine.js';
import { certaintyOf } from './evidence.js';
import { relationshipConfig, enrichWithRelationships } from './code-relationships.js';
import { structuralRankingConfig, applyStructuralRanking } from './structural-ranking.js';
import { createDefaultProvider } from './repograph-provider.js';

// Etapa 4: structuralRefine spawns `rg` once per anchor, so memoize its
// normalized anchor-density map per cwd (process-scoped; the CLI engine is
// short-lived, so no invalidation is needed).
const _anchorDensityCache = new Map()

// add-repograph-code-relationship-provider: merge enrichment candidates after
// the ranked set, preserving order and deduplicating by file:line range.
function dedupCandidates(base, extra) {
  const seen = new Set(base.map((c) => c.key || `${c.path}:${c.line_start}-${c.line_end}`))
  const out = base.slice()
  for (const c of extra) {
    const k = c.key || `${c.path}:${c.line_start}-${c.line_end}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

export class Retriever {
  /**
   * Retrieve candidates for a given query.
   * @param {string} query - The user query / intent
   * @param {object} opts - Optional: {budget, limit, context}
   * @returns {Promise<Candidate[]>} Sorted by descending score (pre-rerank)
   */
  retrieve(query, opts = {}) {
    return []
  }

  /** Human-readable name of this retriever (for logs/debugging) */
  get name() { return this.constructor.name }
}

/**
 * Standardized candidate result from any retriever.
 * All scores are pre-rerank (raw tool output values).
 */
export class Candidate {
  /**
   * @param {object} fields
   * @param {string} fields.id - Unique identifier (usually `path:line_start:line_end`)
   * @param {string} fields.path - File path relative to repo root
   * @param {number} fields.line_start - 1-indexed start line
   * @param {number} fields.line_end - 1-indexed end line
   * @param {number} fields.score - Raw relevance score (pre-rerank)
   * @param {string} fields.source - e.g. "search-code", "symbol-lookup", "bm25"
   * @param {string} fields.match_type - e.g. "substring", "symbol", "semantic"
   * @param {string} fields.snippet - Short text excerpt around the match
   */
  constructor({ id, path, line_start, line_end, score, source, match_type, snippet } = {}) {
    this.id = id || ''
    this.path = path || ''
    this.line_start = line_start != null ? Math.max(1, line_start) : 1
    this.line_end = line_end != null ? Math.max(this.line_start, line_end) : this.line_start
    this.score = Number.isFinite(score) ? score : 0
    this.source = source || 'unknown'
    this.match_type = match_type || 'unknown'
    this.snippet = snippet || ''
  }

  /** Full file path + line range for display */
  get key() { return `${this.path}:${this.line_start}-${this.line_end}` }

  /** Human-readable description */
  get desc() { return `${this.source} @ ${this.key} (score: ${this.score.toFixed(2)})` }
}

/**
 * Score contributions used by the Reranker.
 * Each retriever may expose its own score schema; the reranker normalizes
 * them into a unified { relevance, coverage, sourceQuality, confidence } model.
 */
export const ScoreContribution = {
  /** Lexical match quality (0–1, from tool output) */
  relevance: 0,
  /** How much of the query is addressed (0–1, estimated from matches) */
  coverage: 0,
  /** Source trustworthiness / quality (0–1, from config / metadata) */
  sourceQuality: 0,
  /** Intent / planning confidence (0–1, from Interpreter) */
  confidence: 0
}

/**
 * Reranker — combines multiple ScoreContribution sources into a final rank.
 * Supports interchangeable strategies: rule-based, CrossEncoder, LLM-based.
 *
 * The default implementation is a weighted sum:
 *   final = w_relevance * relevance
 *         + w_coverage * coverage
 *         + w_sourceQuality * sourceQuality
 *         + w_confidence * confidence
 *
 * Weights default to [0.4, 0.3, 0.2, 0.1] favoring relevance + coverage.
 */
export class Reranker {
  constructor({ weights, featureWeights } = {}) {
    // Weights: [relevance, coverage, sourceQuality, confidence]
    this.weights = weights || [0.4, 0.3, 0.2, 0.1]
    if (this.weights.length !== 4) {
      console.warn('Reranker: weights should be an array of 4 numbers')
    }
    // Etapa 4 (doc B §3): additive rerank features
    // [anchor_density, symbol_hit, provenance_certainty]. Kept separate from the
    // 4-tuple so existing callers/weights remain backward-compatible.
    // Env-overridable for tuning; anchor_density is the only costly feature
    // (structural-refine spawns rg per anchor) so it is gated on its weight > 0.
    this.featureWeights = featureWeights || [
      Number(process.env.CF_RF_ANCHOR ?? 0.05),
      Number(process.env.CF_RF_SYMBOL ?? 0.1),
      Number(process.env.CF_RF_CERTAINTY ?? 0.0)
    ]
  }

  /**
   * Rerank a list of Candidates using combined scores.
   * @param {Candidate[]} candidates - Unsorted (pre-rerank scores)
   * @param {object} context - Additional context: { intentConfidence, ... }
   * @returns {Candidate[]} Sorted by descending final score
   */
  rerank(candidates, context = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return candidates

    const anchorMap = context.anchorDensity || null // Map(path -> 0..1)
    const symbolPaths = context.symbolPaths || null // Set(path)
    const fw = this.featureWeights || [0, 0, 0]

    return candidates.map(c => {
      // Normalize each contribution to 0–1 if not already
      const rel = Math.max(0, Math.min(1, c.score))
      const cov = Math.max(0, Math.min(1, context.coverage || 0.5))
      const sq = Math.max(0, Math.min(1, context.sourceQuality || 0.5))
      const cf = Math.max(0, Math.min(1, context.intentConfidence || 0.5))

      // Etapa 4 features (doc B §3)
      const anchorDensity = anchorMap ? (anchorMap.get(c.path) || 0) : 0
      const symbolHit = symbolPaths && symbolPaths.has(c.path) ? 1 : 0
      const provenanceCertainty = certaintyOf(c.match_type)

      const base =
        this.weights[0] * rel +
        this.weights[1] * cov +
        this.weights[2] * sq +
        this.weights[3] * cf

      const final =
        base +
        fw[0] * anchorDensity +
        fw[1] * symbolHit +
        fw[2] * provenanceCertainty

      c.features = { anchor_density: anchorDensity, symbol_hit: symbolHit, provenance_certainty: provenanceCertainty }
      c.score = final
      return c
    }).sort((a, b) => b.score - a.score)
  }
}

export class LexicalRetriever extends Retriever {
  async retrieve(query, opts = {}) {
    const cwd = opts.cwd || process.cwd()
    const limit = opts.limit || 50
    const queryWords = String(query).toLowerCase().split(/\s+/).filter(Boolean)
    try {
      const raw = bm25Score(cwd, queryWords, limit)
      if (Array.isArray(raw)) {
        return raw.map((r, i) => {
          const filePath = typeof r === 'string' ? r : (r.path || r.file || '')
          const scoreVal = typeof r === 'object' && r.score != null ? r.score : (1 / (i + 1))
          return new Candidate({
            id: `${filePath}:1:1`,
            path: filePath,
            line_start: 1,
            line_end: 1,
            score: scoreVal,
            source: 'lexical',
            match_type: 'bm25',
            snippet: typeof r === 'object' && r.snippet ? r.snippet : ''
          })
        })
      }
    } catch (e) {
      // fallback
    }
    return []
  }
}

export class StructuralRetriever extends Retriever {
  async retrieve(query, opts = {}) {
    const cwd = opts.cwd || process.cwd()
    const limit = opts.limit || 50
    try {
      ensureIndex(cwd)
      const name = parseName(query)
      if (!name) return []
      const rows = symbolLookup(cwd, name, limit)
      if (Array.isArray(rows)) {
        return rows.map((r, i) => new Candidate({
          id: `${r.path}:${r.line_start || 1}:${r.line_end || 1}`,
          path: r.path,
          line_start: r.line_start || 1,
          line_end: r.line_end || 1,
          score: r.score ?? (1 / (i + 1)),
          source: 'structural',
          match_type: 'structural',
          snippet: r.content || ''
        }))
      }
    } catch (e) {
      // fallback
    }
    return []
  }
}

export class ExpansionRetriever extends Retriever {
  async retrieve(query, opts = {}) {
    const cwd = opts.cwd || process.cwd()
    const limit = opts.limit || 50
    const { expandedQuery, terms, skipped } = expandQuery(query, {
      cwd, queryType: opts.queryType, topK: opts.prfTopK, maxTerms: opts.prfMaxTerms
    })
    if (skipped || !terms.length) return []
    try {
      const raw = bm25Score(cwd, expandedQuery, limit)
      if (Array.isArray(raw)) {
        return raw.map((r, i) => new Candidate({
          id: `${r.path}:1:1`,
          path: r.path,
          line_start: 1,
          line_end: 1,
          score: r.score ?? (1 / (i + 1)),
          source: 'expanded',
          match_type: 'expanded',
          snippet: ''
        }))
      }
    } catch (e) {
      // fallback
    }
    return []
  }
}

/**
 * Hybrid retrieval entry point.
 * Runs multiple retrievers in parallel, gathers candidates, fuses via RRF, reranks, and selects via MMR.
 *
 * @param {Retriever[]} retrievers - List of initialized retrievers
 * @param {string} query - The user query
 * @param {object} opts - { budget, limit, queryType, intentConfidence?, sourceQuality?, cwd? }
 * @returns {Promise<{selected: Candidate[], used: number, pool: Candidate[], fused: Candidate[], candidates: Candidate[], reranker: Reranker, perRetriever: Record<string, Candidate[]>}>}
 */
export async function hybridRetrieval(retrievers, query, opts = {}) {
  const { budget = 8000, limit = 50, queryType = 'default', intentConfidence = 0.5, sourceQuality = 0.5 } = opts
  const cwd = opts.cwd || process.cwd()

  // Run all retrievers in parallel
  const retrievePromises = retrievers.map(r => r.retrieve(query, { ...opts, cwd }))
  const results = await Promise.allSettled(retrievePromises)

  // Collect candidates per retriever and build pool
  const perRetriever = {}
  const pool = []
  retrievers.forEach((r, i) => {
    if (results[i].status === 'fulfilled') {
      const cands = results[i].value || []
      perRetriever[r.name] = cands
      pool.push(...cands)
    } else {
      console.error(`Retriever ${r.name} failed:`, results[i].reason)
      perRetriever[r.name] = []
    }
  })

  // Apply RRF Fusion
  let fused = []
  try {
    const fusedRes = rrfFuse(pool, queryType)
    if (Array.isArray(fusedRes)) {
      fused = fusedRes
    } else if (fusedRes instanceof Map) {
      fused = Array.from(fusedRes.values())
    } else if (fusedRes && typeof fusedRes === 'object') {
      fused = Object.values(fusedRes)
    }
  } catch (e) {
    fused = pool
  }

  // Apply reranker
  const reranker = new Reranker({
    weights: opts.weights || [0.4, 0.3, 0.2, 0.1],
    sourceQuality: sourceQuality,
    intentConfidence: intentConfidence
  })

  // Etapa 4 (doc B §3): rerank features — anchor_density (structural-refine),
  // symbol_hit (symbolLookup), provenance_certainty (evidence.certaintyOf).
  let anchorDensity = null
  if (reranker.featureWeights && reranker.featureWeights[0] > 0) {
    if (_anchorDensityCache.has(cwd)) {
      anchorDensity = _anchorDensityCache.get(cwd)
    } else {
      try {
        const structRows = structuralRefine(cwd, 50)
        if (Array.isArray(structRows) && structRows.length) {
          const max = Math.max(...structRows.map(r => r.score ?? 0)) || 1
          anchorDensity = new Map(
            structRows.map(r => [String(r.path).replace(/^\.\//, ''), Math.max(0, Math.min(1, (r.score ?? 0) / max))])
          )
        }
      } catch (e) { /* fallback */ }
      _anchorDensityCache.set(cwd, anchorDensity)
    }
  }

  let symbolPaths = null
  try {
    const name = parseName(query)
    if (name) {
      const rows = symbolLookup(cwd, name, limit)
      if (Array.isArray(rows) && rows.length) {
        symbolPaths = new Set(rows.map(r => String(r.path || '').replace(/^\.\//, '')).filter(Boolean))
      }
    }
  } catch (e) { /* fallback */ }

  const ranked = reranker.rerank(fused.length > 0 ? fused : pool, {
    coverage: 0.5,
    intentConfidence: intentConfidence,
    sourceQuality: sourceQuality,
    anchorDensity,
    symbolPaths
  })

  // Experimental relationship enrichment (change
  // add-repograph-code-relationship-provider). Disabled by default: when off or
  // unavailable this is a no-op and `enriched === ranked`, preserving behavior.
  let enriched = ranked
  try {
    const relCfg = opts.relationshipConfig || relationshipConfig(process.env)
    if (relCfg.enabled) {
      const provider = opts.relationshipProvider ||
        createDefaultProvider({ repoRoot: cwd, coreDir: relCfg.coreDir })
      const extra = await enrichWithRelationships(ranked, provider, relCfg, { query })
      if (extra.length) enriched = dedupCandidates(ranked, extra.map((c) => new Candidate(c)))
    }
  } catch (e) { enriched = ranked }

  // Experimental structural ranking (change add-repograph-structural-ranking).
  // Query-dependent import-consensus prior over already-retrieved candidates.
  // Disabled by default: no-op when off/unavailable, preserving behavior.
  let rankedCandidates = enriched
  try {
    const rankCfg = opts.rankingConfig || structuralRankingConfig(process.env)
    if (rankCfg.enabled) {
      const provider = opts.relationshipProvider ||
        createDefaultProvider({ repoRoot: cwd, coreDir: rankCfg.coreDir })
      rankedCandidates = await applyStructuralRanking(enriched, provider, rankCfg)
    }
  } catch (e) { rankedCandidates = enriched }

  // Apply MMR selector
  let selected = rankedCandidates.slice(0, limit)
  let used = 0
  try {
    const mmrRes = selectMMR(rankedCandidates, budget)
    if (mmrRes) {
      if (Array.isArray(mmrRes)) {
        selected = mmrRes
      } else if (mmrRes.selected) {
        selected = mmrRes.selected
        used = mmrRes.used || 0
      }
    }
  } catch (e) {
    // fallback
  }

  return {
    selected,
    used,
    pool,
    fused,
    candidates: selected,
    reranker,
    perRetriever
  }
}
