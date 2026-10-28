/**
 * repograph-provider.js — optional adapter over a pinned, vendored
 * `@repograph/core` (MIT, revision in vendor/repograph/REVISION). Disabled by
 * default. When the vendored core or the Node >= 22.5 `node:sqlite` runtime is
 * absent, `getStatus()` reports the reason and every query returns `[]` (safe
 * fallback). No upstream types escape this module; everything is normalized to
 * the CQE contract.
 *
 * Upstream API (v0.1.0):
 *   - defaultDatabasePath(rootDir) -> "<rootDir>/.repograph/index.sqlite"
 *   - new RepositoryIndexer(dbPath).index({ rootDir })  -> IndexSummary
 *   - new GraphStore(dbPath): search(query, limit) -> SearchResult[]; getNode(id);
 *     getEdges(nodeId) -> GraphEdge[]; getRelatedNodes(id, "outgoing"|"incoming")
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CodeRelationshipProvider } from './code-relationships.js'

const require = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIN_NODE = [22, 5]
const DEFAULT_CORE = path.resolve(HERE, '..', 'vendor', 'repograph', 'dist', 'index.js')

function nodeTooOld(v = process.versions.node) {
  const [maj, min] = String(v).split('.').map(Number)
  return maj < MIN_NODE[0] || (maj === MIN_NODE[0] && min < MIN_NODE[1])
}

function hasSqlite() {
  try { require('node:sqlite'); return true } catch { return false }
}

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])
const rel = (p) => String(p || '').replace(/^\.\//, '')

// Task 2.4: exclude generated, vendored, ignored, and binary paths.
const DEFAULT_IGNORE = [
  '**/node_modules/**', '**/.git/**', '**/vendor/**', '**/dist/**',
  '**/build/**', '**/coverage/**', '**/*.min.js', '**/*.map'
]
const EXCLUDED_RE = /(^|\/)(node_modules|\.git|vendor|dist|build|coverage)(\/|$)/
const SOURCE_EXT = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx',
  '.vue', '.svelte', '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.swift', '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.php'
])
export function isExcludedPath(p) {
  return EXCLUDED_RE.test(rel(p))
}

function normalizeSymbols(results) {
  return asArray(results).map((r) => {
    const n = r && r.node ? r.node : r
    if (!n || typeof n !== 'object') return null
    const p = rel(n.filePath || n.path || '')
    const name = String(n.name || '')
    if (!p && !name) return null
    if (p && isExcludedPath(p)) return null
    const start = Number(n.start?.line ?? n.line_start ?? 1) || 1
    return {
      id: String(n.id || `${n.kind || 'symbol'}:${p}::${name}`),
      name,
      kind: String(n.kind || 'symbol'),
      path: p,
      line_start: start,
      line_end: Number(n.end?.line ?? n.line_end ?? start) || start,
      signature: n.signature ? String(n.signature) : undefined
    }
  }).filter(Boolean)
}

function normalizeRelationship(edge, direction, related, revision) {
  if (!related) return null
  const p = rel(related.filePath || '')
  if (!p || isExcludedPath(p)) return null
  const start = Number(related.start?.line ?? 1) || 1
  return {
    source_id: String(edge.sourceId || ''),
    target_id: String(edge.targetId || ''),
    type: String(edge.kind || edge.type || 'references'),
    direction,
    path: p,
    line_start: start,
    line_end: Number(related.end?.line ?? start) || start,
    detection: 'static',
    resolution: 'resolved',
    revision
  }
}

export class RepographProvider extends CodeRelationshipProvider {
  constructor(opts = {}) {
    super()
    this.repoRoot = opts.repoRoot || process.cwd()
    this.coreDir = opts.coreDir ? path.resolve(opts.coreDir) : DEFAULT_CORE
    this.dbPath = opts.dbPath || null
    this.autoIndex = opts.autoIndex !== false
    this.ignorePatterns = Array.isArray(opts.ignorePatterns) ? opts.ignorePatterns : DEFAULT_IGNORE
    this.maxFileSizeBytes = opts.maxFileSizeBytes
    this.staleCheckMs = Number.isFinite(opts.staleCheckMs) ? opts.staleCheckMs : 5000
    this._core = null
    this._store = null
    this._indexed = false
    this._status = null
    this._revision = null
    this._staleCheckedAt = 0
    this._stale = false
  }

  async _load() {
    if (this._core) return this._core
    if (nodeTooOld()) { this._fail(`node<${MIN_NODE.join('.')}: node:sqlite unavailable`); return null }
    if (!hasSqlite()) { this._fail('node:sqlite unavailable'); return null }
    if (!fs.existsSync(this.coreDir)) { this._fail(`vendored core not found at ${this.coreDir}`); return null }
    try {
      this._core = await import(pathToFileURL(this.coreDir).href)
      if (!this.dbPath) this.dbPath = this._core.defaultDatabasePath(this.repoRoot)
      return this._core
    } catch (e) {
      this._fail(`core import failed: ${e.message}`)
      return null
    }
  }

  _fail(reason) {
    this._status = { available: false, reason, runtime: process.versions.node }
  }

  /** Index once (incremental), detect staleness, and open the store. Never throws. */
  async _ensureStore() {
    const core = await this._load()
    if (!core) return null
    if (!this.dbPath) this.dbPath = core.defaultDatabasePath(this.repoRoot)
    if (this._store) return this._store
    try {
      const present = fs.existsSync(this.dbPath)
      const stale = present && this._isStale()
      if (this.autoIndex && (!present || stale)) {
        const indexer = new core.RepositoryIndexer(this.dbPath)
        this._summary = await indexer.index({
          rootDir: this.repoRoot,
          ignorePatterns: this.ignorePatterns,
          maxFileSizeBytes: this.maxFileSizeBytes,
          force: stale
        })
        this._indexed = true
        this._stale = false
        this._staleCheckedAt = Date.now()
      }
      this._revision = this._dbRevision()
      this._store = new core.GraphStore(this.dbPath)
      return this._store
    } catch (e) {
      this._fail(`index/open failed: ${e.message}`)
      return null
    }
  }

  _dbRevision() {
    const m = this._dbMtime()
    return m ? String(m) : undefined
  }

  /** Newest mtime across the SQLite db and its WAL sidecar (WAL writes don't touch the db file). */
  _dbMtime() {
    let newest = 0
    for (const p of [this.dbPath, `${this.dbPath}-wal`]) {
      try {
        const s = fs.statSync(p).mtimeMs
        if (s > newest) newest = s
      } catch { /* absent */ }
    }
    return newest
  }

  /** True when source files are newer than the index (bounded, throttled). */
  _isStale() {
    if (!fs.existsSync(this.dbPath)) return true
    const now = Date.now()
    if (now - this._staleCheckedAt < this.staleCheckMs) return this._stale
    let stale = false
    try {
      stale = this._newestSourceMtime() > this._dbMtime() + 1000
    } catch { stale = false }
    this._stale = stale
    this._staleCheckedAt = now
    return stale
  }

  /** Newest mtime among source files, bounded and excluding generated/vendored paths. */
  _newestSourceMtime(limit = 5000) {
    let newest = 0
    let seen = 0
    const walk = (dir) => {
      if (seen >= limit) return
      let entries = []
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const ent of entries) {
        if (seen >= limit) return
        const full = path.join(dir, ent.name)
        const relPath = rel(path.relative(this.repoRoot, full))
        if (ent.isDirectory()) {
          if (EXCLUDED_RE.test(relPath + '/')) continue
          walk(full)
        } else if (ent.isFile()) {
          seen++
          if (EXCLUDED_RE.test(relPath)) continue
          if (!SOURCE_EXT.has(path.extname(ent.name).toLowerCase())) continue
          try {
            const m = fs.statSync(full).mtimeMs
            if (m > newest) newest = m
          } catch { /* ignore */ }
        }
      }
    }
    walk(this.repoRoot)
    return newest
  }

  async getStatus() {
    if (this._status && this._status.available === false) return this._status
    const core = await this._load()
    if (!core) return this._status
    if (!this.dbPath) this.dbPath = core.defaultDatabasePath(this.repoRoot)
    const present = fs.existsSync(this.dbPath)
    const fresh = present && !this._isStale()
    this._status = {
      available: true,
      runtime: process.versions.node,
      revision: this._revision ?? this._dbRevision(),
      index: { present, fresh, path: this.dbPath }
    }
    return this._status
  }

  async findSymbols(query, opts = {}) {
    const store = await this._ensureStore()
    if (!store) return []
    try {
      return normalizeSymbols(store.search(String(query), opts.limit ?? 5))
    } catch { return [] }
  }

  async getRelationships(symbolId, opts = {}) {
    const store = await this._ensureStore()
    if (!store || typeof store.getEdges !== 'function') return []
    try {
      const limit = opts.limit ?? 10
      const direction = opts.direction ?? 'both'
      const out = []
      const edges = asArray(store.getEdges(String(symbolId)))
      for (const edge of edges) {
        if (out.length >= limit) break
        const self = edge.sourceId === symbolId ? 'out' : 'in'
        if (direction !== 'both' && direction !== self) continue
        const otherId = self === 'out' ? edge.targetId : edge.sourceId
        const related = store.getNode(otherId)
        const norm = normalizeRelationship(edge, self, related, this._revision)
        if (norm) out.push(norm)
      }
      return out
    } catch { return [] }
  }

  async getFileRelationships(filePath, opts = {}) {
    const store = await this._ensureStore()
    const core = this._core
    if (!store || !core || typeof core.stableId !== 'function') return []
    try {
      const id = core.stableId('file', rel(filePath))
      if (!store.getNode(id)) return []
      const limit = opts.limit ?? 10
      const direction = opts.direction ?? 'both'
      const cats = opts.categories && opts.categories.length ? new Set(opts.categories) : null
      const out = []
      for (const edge of asArray(store.getEdges(id))) {
        if (out.length >= limit) break
        if (cats && !cats.has(edge.kind)) continue
        if (!cats && edge.kind === 'contains') continue
        const self = edge.sourceId === id ? 'out' : 'in'
        if (direction !== 'both' && direction !== self) continue
        const related = store.getNode(self === 'out' ? edge.targetId : edge.sourceId)
        const norm = normalizeRelationship(edge, self, related, this._revision)
        if (norm) out.push(norm)
      }
      return out
    } catch { return [] }
  }
}

/** Factory used by the retrieval integration when enrichment is enabled. */
export function createDefaultProvider(opts = {}) {
  return new RepographProvider(opts)
}
