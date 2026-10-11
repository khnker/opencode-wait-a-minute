/**
 * structural-ranking.js — optional, query-dependent structural ranking prior
 * (change: add-repograph-structural-ranking).
 *
 * Boosts candidates that were ALREADY retrieved by "import-consensus": how many
 * of the candidates in the current pool import the candidate's file, using the
 * cross-file `imports` edges of the local code graph. It adds no candidates and
 * never throws; disabled by default and a no-op when the provider is unavailable.
 */

const TRUE = new Set(['1', 'true', 'yes', 'on'])
const pkey = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '')
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const pos = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : d }

/** Read structural-ranking configuration. Disabled by default. */
export function structuralRankingConfig(env = process.env) {
  const e = env || {}
  return {
    enabled: TRUE.has(String(e.CF_REPOGRAPH_RANK || '').toLowerCase()),
    alpha: Math.max(0, num(e.CF_REPOGRAPH_RANK_ALPHA, 0.5)),
    maxFiles: pos(e.CF_REPOGRAPH_RANK_FILES, 40),
    limit: pos(e.CF_REPOGRAPH_RANK_LIMIT, 20)
  }
}

async function isAvailable(provider) {
  try {
    const st = await provider.getStatus()
    return !!(st && st.available)
  } catch { return false }
}

/**
 * Apply the structural prior to already-retrieved candidates.
 * Returns the input unchanged when disabled, unavailable, or consensus is empty.
 * @param {Array<{path:string,score:number}>} candidates
 * @param {{getStatus:Function,getFileRelationships:Function}} provider
 * @param {ReturnType<typeof structuralRankingConfig>} cfg
 */
export async function applyStructuralRanking(candidates, provider, cfg) {
  if (!provider || !cfg || !cfg.enabled) return candidates
  if (!Array.isArray(candidates) || candidates.length === 0) return candidates
  if (!(await isAvailable(provider))) return candidates

  const pool = candidates.slice(0, cfg.maxFiles)
  const importers = new Map()
  for (const c of pool) {
    if (!c || !c.path) continue
    let rels = []
    try {
      rels = await provider.getFileRelationships(c.path, {
        direction: 'out', categories: ['imports'], limit: cfg.limit
      })
    } catch { continue }
    for (const r of rels || []) {
      if (!r || !r.path) continue
      const k = pkey(r.path)
      importers.set(k, (importers.get(k) || 0) + 1)
    }
  }
  if (importers.size === 0) return candidates

  let max = 0
  for (const v of importers.values()) if (v > max) max = v
  if (max <= 0) return candidates

  return candidates.map((c) => {
    if (!c || !c.path) return c
    const consensus = (importers.get(pkey(c.path)) || 0) / max
    if (consensus <= 0) return c
    const base = Number.isFinite(c.score_final) ? c.score_final : 0.5
    return Object.assign(Object.create(Object.getPrototypeOf(c)), c, {
      score_final: base + cfg.alpha * 0.5 * consensus,
      structural_consensus: consensus
    })
  })
}
