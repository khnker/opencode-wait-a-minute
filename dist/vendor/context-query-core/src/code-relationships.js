/**
 * code-relationships.js — provider-agnostic contract for code relationship
 * enrichment (change: add-repograph-code-relationship-provider).
 *
 * This module owns the CQE-side types. It MUST NOT import upstream
 * (@repograph/core) types; adapters map into these shapes. Enrichment is
 * disabled by default and safe: providers that are missing, stale, or
 * incompatible degrade to a no-op via `getStatus().available === false`.
 */

/** Relationship categories CQE understands (superset of upstream edge kinds). */
export const RELATIONSHIP_TYPES = Object.freeze([
  'imports', 'exports', 'contains', 'calls', 'extends', 'implements',
  'references', 'depends_on', 'renders', 'reads', 'writes', 'routes_to'
])

/** Resolution state of a relationship's target. */
export const RESOLUTION_STATUS = Object.freeze(['resolved', 'unresolved', 'external'])

/**
 * @typedef {object} SymbolQuery
 * @property {string} query
 * @property {number} [limit]
 * @property {string[]} [categories]
 */

/**
 * @typedef {object} SymbolMatch
 * @property {string} id           - Stable, provider-canonical symbol id
 * @property {string} name
 * @property {string} kind         - function|class|method|interface|type|variable|component|import|export
 * @property {string} path         - repo-relative file path
 * @property {number} line_start
 * @property {number} line_end
 * @property {string} [signature]
 */

/**
 * @typedef {object} CodeRelationship
 * @property {string} source_id
 * @property {string} target_id
 * @property {string} type         - one of RELATIONSHIP_TYPES
 * @property {'out'|'in'} direction
 * @property {string} path         - evidence file (repo-relative)
 * @property {number} line_start
 * @property {number} line_end
 * @property {string} detection    - 'tree-sitter'|'regex'|'static'
 * @property {string} resolution   - one of RESOLUTION_STATUS
 * @property {number} [confidence] - 0..1
 * @property {string} [revision]   - index revision the evidence came from
 */

/**
 * @typedef {object} RelationshipProviderStatus
 * @property {boolean} available
 * @property {string} [reason]     - why unavailable (when available=false)
 * @property {{present:boolean, revision?:string, fresh?:boolean}} [index]
 * @property {string} [runtime]    - node version
 */

/**
 * Base provider contract. Adapters extend this. All methods MUST be async and
 * MUST NOT throw for expected failure modes (missing index, absent core);
 * they return empty results and surface state through `getStatus()`.
 */
export class CodeRelationshipProvider {
  async findSymbols(_query, _opts = {}) { return [] }

  async getRelationships(_symbolId, _opts = {}) { return [] }

  /** Cross-file relationships of a file node (e.g. imports). */
  async getFileRelationships(_filePath, _opts = {}) { return [] }

  async getStatus() {
    return { available: false, reason: 'not-implemented' }
  }
}

const truthy = (v) => v === '1' || String(v).toLowerCase() === 'true'
const pos = (v, d) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : d
}

/**
 * Read enrichment configuration. Defaults preserve existing behavior
 * (enrichment disabled). Every override is a `CF_REPOGRAPH_*` env var.
 * @param {Record<string,string|undefined>} [env]
 */
export function relationshipConfig(env = process.env) {
  const e = env || {}
  const dir = e.CF_REPOGRAPH_DIRECTION
  return Object.freeze({
    enabled: truthy(e.CF_REPOGRAPH_ENABLED),
    depth: pos(e.CF_REPOGRAPH_DEPTH, 1),
    symbolLimit: pos(e.CF_REPOGRAPH_SYMBOLS, 5),
    relationshipLimit: pos(e.CF_REPOGRAPH_REL_LIMIT, 10),
    maxExtra: pos(e.CF_REPOGRAPH_MAX_EXTRA, 8),
    fileSeeds: pos(e.CF_REPOGRAPH_FILE_SEEDS, 5),
    categories: String(e.CF_REPOGRAPH_CATEGORIES || '')
      .split(',').map((s) => s.trim()).filter(Boolean),
    direction: dir === 'in' || dir === 'out' ? dir : 'both',
    coreDir: e.CF_REPOGRAPH_DIR || null
  })
}

/** Wrap getStatus so a misbehaving provider can never throw into retrieval. */
export async function safeStatus(provider) {
  try {
    const s = await provider?.getStatus?.()
    if (s && typeof s === 'object') return { available: !!s.available, ...s }
  } catch { /* fallthrough to unavailable */ }
  return { available: false, reason: 'status-error' }
}

const pkey = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '')

/** Map a CodeRelationship to a low-priority Candidate-shaped object. */
export function relationshipToCandidate(rel) {
  const fallback = rel.resolution === 'resolved' ? 0.3 : rel.resolution === 'external' ? 0.15 : 0.1
  const raw = rel.confidence != null ? rel.confidence : fallback
  const score = Math.max(0, Math.min(1, Number(raw) || 0))
  return {
    id: `rel:${rel.type}:${rel.source_id}->${rel.target_id}`,
    path: rel.path,
    line_start: rel.line_start,
    line_end: rel.line_end,
    score,
    source: 'repograph',
    match_type: `relationship:${rel.type}`,
    snippet: ''
  }
}

/**
 * Expand task-relevant relationships from a provider into extra candidates.
 * Bounded by `cfg.maxExtra` and deduplicated against `candidates`. Never throws.
 * @param {Array<{path:string,line_start:number,line_end:number}>} candidates
 * @param {CodeRelationshipProvider} provider
 * @param {ReturnType<typeof relationshipConfig>} cfg
 * @param {{query?:string}} [ctx]
 */
export async function enrichWithRelationships(candidates, provider, cfg, { query } = {}) {
  if (!provider || !cfg || !cfg.enabled) return []
  const status = await safeStatus(provider)
  if (!status.available) return []

  const existing = new Set((candidates || []).map((c) => pkey(c.path)))
  const seen = new Set()
  const out = []

  let symbols = []
  try {
    symbols = await provider.findSymbols(query, { limit: cfg.symbolLimit, categories: cfg.categories })
  } catch { return [] }

  for (const sym of (symbols || []).slice(0, cfg.symbolLimit)) {
    if (out.length >= cfg.maxExtra) break
    let rels = []
    try {
      rels = await provider.getRelationships(sym.id, {
        depth: cfg.depth,
        limit: cfg.relationshipLimit,
        categories: cfg.categories,
        direction: cfg.direction
      })
    } catch { continue }
    for (const rel of rels || []) {
      if (out.length >= cfg.maxExtra) break
      if (!rel || !rel.path) continue
      const key = pkey(rel.path)
      if (existing.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(relationshipToCandidate(rel))
    }
  }

  // File-level expansion: pull cross-file relationships (e.g. imports) of the
  // already-retrieved files — the strongest signal the symbol pass misses.
  const seeds = (candidates || []).slice(0, cfg.fileSeeds || 0)
  for (const seed of seeds) {
    if (out.length >= cfg.maxExtra) break
    if (!seed || !seed.path) continue
    let rels = []
    try {
      rels = await provider.getFileRelationships(seed.path, {
        limit: cfg.relationshipLimit,
        categories: cfg.categories,
        direction: cfg.direction
      })
    } catch { continue }
    for (const rel of rels || []) {
      if (out.length >= cfg.maxExtra) break
      if (!rel || !rel.path) continue
      const key = pkey(rel.path)
      if (existing.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(relationshipToCandidate(rel))
    }
  }
  return out
}
