import fs from 'node:fs'
import path from 'node:path'

const rel = (p) => String(p || '').replace(/^\.\//, '')
const lineAt = (source, index) => source.slice(0, index).split('\n').length
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normExt = (e) => String(e || '').toLowerCase().replace(/^\./, '')

export const COUPLING_EDGE_KINDS = ['renders', 'calls', 'routes_to', 'references']

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', 'coverage', '.repograph'])
const SOURCE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.vue', '.html',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h',
  '.cc', '.cpp', '.hpp', '.cs', '.php', '.scala', '.sh'
])

export function isExcludedRelPath(p) {
  return rel(p).split('/').some((seg) => EXCLUDED_DIRS.has(seg))
}

function matchBrace(source, openIdx) {
  let depth = 0
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Find `name(` declared as a member (not `this.name(`), and return its body range + decl line. */
export function findMethodRange(source, name) {
  const re = new RegExp(`(^|[^\\w.$])${escapeRe(name)}\\s*\\(`, 'm')
  const m = re.exec(source)
  if (!m) return null
  const searchFrom = m.index + m[0].length
  const open = source.indexOf('{', searchFrom)
  const semi = source.indexOf(';', searchFrom)
  if (open === -1 || (semi !== -1 && semi < open)) return null
  const close = matchBrace(source, open)
  if (close === -1) return null
  return { start: open, end: close, line: lineAt(source, m.index + (m[1] ? m[1].length : 0)) }
}

export function extractTemplateBindings(html) {
  const out = []
  const push = (m, kind, key) => {
    const expr = m[2]
    const handler = key === 'event' ? (/^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(expr) || [])[1] : undefined
    out.push({ kind: 'renders', event: kind === 'event' ? m[1] : undefined, prop: kind === 'prop' ? m[1] : undefined, expr, handler, line: lineAt(html, m.index) })
  }
  for (const m of html.matchAll(/\(([\w-]+)\)\s*=\s*"([^"]*)"/g)) push(m, 'event', 'event')
  for (const m of html.matchAll(/\[([\w.-]+)\]\s*=\s*"([^"]*)"/g)) push(m, 'prop', 'prop')
  return out
}

export function extractComponentMeta(ts) {
  const className = (/export\s+class\s+([A-Za-z_$][\w$]*)/.exec(ts) || [])[1]
  const selector = (/selector\s*:\s*['"]([^'"]+)['"]/.exec(ts) || [])[1]
  const templateUrl = (/templateUrl\s*:\s*['"]([^'"]+)['"]/.exec(ts) || [])[1]
  const di = {}
  const ctor = /constructor\s*\(([^)]*)\)/.exec(ts)
  if (ctor) {
    for (const seg of ctor[1].split(',')) {
      const m = /([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/.exec(seg)
      if (m) di[m[1]] = m[2]
    }
  }
  return { className, selector, templateUrl, di }
}

export function extractCalls(ts, range) {
  const slice = range ? ts.slice(range.start, range.end) : ts
  const base = range ? range.start : 0
  const out = []
  for (const m of slice.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)) {
    out.push({ kind: 'calls', receiverVar: m[1], method: m[2], line: lineAt(ts, base + m.index) })
  }
  return out
}

export function extractRoutes(ts, range) {
  const slice = range ? ts.slice(range.start, range.end) : ts
  const base = range ? range.start : 0
  const out = []
  for (const m of slice.matchAll(/this\.[A-Za-z_$][\w$]*\s*\.\s*(get|post|put|patch|delete|head|options)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi)) {
    out.push({ kind: 'routes_to', verb: m[1].toUpperCase(), path: m[2], line: lineAt(ts, base + m.index) })
  }
  return out
}

// --- Language-agnostic extraction (works for any text source) ---

const DECL_KEYWORDS = 'function|def|func|fn|sub|proc|class|interface|struct|enum|trait|module|namespace|impl'

function pushDecl(out, seen, name, kind, line) {
  if (!name || seen.has(name)) return
  seen.add(name)
  out.push({ name, kind, line })
}

/** Declarations for any language: keyword decls, assignments, and callable signatures. */
export function extractDeclarations(source) {
  const out = []
  const seen = new Set()
  const kw = new RegExp(`\\b(?:${DECL_KEYWORDS})\\s+([A-Za-z_$][\\w$]*)`, 'g')
  for (const m of source.matchAll(kw)) pushDecl(out, seen, m[1], 'symbol', lineAt(source, m.index))
  for (const m of source.matchAll(/\b(?:const|let|var|final|val|static)\s+([A-Za-z_$][\w$]*)\s*[=:]/g)) {
    pushDecl(out, seen, m[1], 'variable', lineAt(source, m.index))
  }
  for (const m of source.matchAll(/(^|\n)[ \t]*(?:public|private|protected|static|async|override|virtual|export|default|def|func|fn|\s)*([A-Za-z_$][\w$]*)\s*\([^;{)]*\)\s*(?:\{|=>|:)/g)) {
    pushDecl(out, seen, m[2], 'callable', lineAt(source, m.index))
  }
  return out
}

/** Reference sites of a symbol for any language; a following `(` marks a call. */
export function extractReferences(source, symbol) {
  if (!symbol) return []
  const re = new RegExp(`\\b${escapeRe(symbol)}\\b`, 'g')
  const out = []
  for (const m of source.matchAll(re)) {
    const call = /^\s*\(/.test(source.slice(m.index + m[0].length))
    out.push({ kind: call ? 'calls' : 'references', line: lineAt(source, m.index) })
  }
  return out
}

// --- Profile registry (extension point for any language) ---

const PROFILES = new Map()

export function registerProfile(exts, profile) {
  for (const e of [].concat(exts)) PROFILES.set(normExt(e), profile)
  return profile
}

const GENERIC_PROFILE = {
  language: 'generic',
  declarations: extractDeclarations,
  references: extractReferences
}

export function profileFor(filePath) {
  return PROFILES.get(normExt(path.extname(filePath))) || GENERIC_PROFILE
}

registerProfile(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'], {
  language: 'typescript',
  declarations: extractDeclarations,
  references: extractReferences,
  componentMeta: extractComponentMeta,
  calls: extractCalls,
  routes: extractRoutes
})
registerProfile(['html', 'vue'], {
  language: 'html',
  declarations: extractDeclarations,
  references: extractReferences,
  bindings: extractTemplateBindings
})

// --- File walk + resolvers ---

export function walkSourceFiles(repoRoot, limit = 5000) {
  const out = []
  const walk = (dir) => {
    if (out.length >= limit) return
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const ent of entries) {
      if (out.length >= limit) return
      if (ent.isDirectory()) {
        if (EXCLUDED_DIRS.has(ent.name)) continue
        walk(path.join(dir, ent.name))
      } else if (ent.isFile()) {
        if (SOURCE_EXTS.has(path.extname(ent.name).toLowerCase())) {
          out.push(rel(path.relative(repoRoot, path.join(dir, ent.name))))
        }
      }
    }
  }
  walk(repoRoot)
  return out
}

export function readSafe(abs) {
  try { return fs.readFileSync(abs, 'utf8') } catch { return null }
}

function makeResolvers(repoRoot) {
  let files = null
  const list = () => (files || (files = walkSourceFiles(repoRoot)))
  const readRel = (p) => readSafe(path.join(repoRoot, p))
  const classCache = new Map()
  return {
    list,
    readRel,
    resolveTemplateComponent(htmlRel) {
      const same = htmlRel.replace(/\.html$/, '.ts')
      if (fs.existsSync(path.join(repoRoot, same))) return same
      const base = path.basename(htmlRel)
      for (const f of list()) {
        if (!f.endsWith('.ts')) continue
        const meta = extractComponentMeta(readRel(f) || '')
        if (meta.templateUrl && path.basename(meta.templateUrl) === base) return f
      }
      return null
    },
    resolveClassFile(className) {
      if (!className) return null
      if (classCache.has(className)) return classCache.get(className)
      let found = null
      for (const f of list()) {
        if (!f.endsWith('.ts')) continue
        const src = readRel(f)
        if (src && new RegExp(`export\\s+class\\s+${escapeRe(className)}\\b`).test(src)) { found = f; break }
      }
      classCache.set(className, found)
      return found
    }
  }
}

/**
 * Language-agnostic reference trace: which files reference `symbol`, and whether
 * each site is a call. Works for any language via the generic profile.
 */
export function traceReferences({ repoRoot, symbol, limit = 500 } = {}) {
  if (!repoRoot || !symbol) return []
  const chain = []
  const seen = new Set()
  for (const f of walkSourceFiles(repoRoot, limit)) {
    const src = readSafe(path.join(repoRoot, f))
    if (!src) continue
    for (const r of profileFor(f).references(src, symbol)) {
      const key = `${f}:${r.line}:${r.kind}`
      if (seen.has(key)) continue
      seen.add(key)
      chain.push({ path: f, symbol, via: r.kind, kind: r.kind, line: r.line })
    }
  }
  return chain
}

/**
 * Trace coupling. Two modes:
 *  - `start` (a template/component file): the UI chain `renders → calls → routes_to`.
 *  - `symbol` (any language): reference sites across the repo (`references`/`calls`).
 * Returns an ordered, deduped chain of { path, symbol?, via, kind, line, event? }. Never throws.
 */
export function traceCoupling({ repoRoot, start, symbol, depth = 4 } = {}) {
  if (!repoRoot) return []
  if (!start && symbol) return traceReferences({ repoRoot, symbol })
  if (!start) return []
  const abs = path.isAbsolute(start) ? start : path.join(repoRoot, start)
  const startRel = rel(path.relative(repoRoot, abs))
  const chain = [{ path: startRel, via: 'start', kind: 'file', line: 1 }]
  const seen = new Set([`${startRel}:`])
  const push = (node) => {
    const key = `${node.path}:${node.symbol || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    chain.push(node)
    return true
  }
  try {
    const r = makeResolvers(repoRoot)
    if (startRel.endsWith('.html') || startRel.endsWith('.vue')) {
      const html = readSafe(abs)
      if (html) {
        const bindings = profileFor(startRel).bindings(html)
        const componentFile = r.resolveTemplateComponent(startRel)
        if (componentFile) {
          const cts = r.readRel(componentFile) || ''
          const meta = extractComponentMeta(cts)
          for (const b of bindings) {
            if (!b.handler) continue
            const range = findMethodRange(cts, b.handler)
            push({ path: componentFile, symbol: `${meta.className || '?'}.${b.handler}`, via: 'renders', kind: 'renders', line: range ? range.line : b.line, event: b.event })
            if (!range || depth < 3) continue
            for (const c of extractCalls(cts, range)) {
              const depType = meta.di[c.receiverVar]
              if (!depType) continue
              const serviceFile = r.resolveClassFile(depType)
              if (!serviceFile) continue
              push({ path: serviceFile, symbol: `${depType}.${c.method}`, via: 'calls', kind: 'calls', line: c.line })
              if (depth < 4) continue
              const sts = r.readRel(serviceFile) || ''
              const srange = findMethodRange(sts, c.method)
              for (const route of extractRoutes(sts, srange || undefined)) {
                push({ path: serviceFile, symbol: `${route.verb} ${route.path}`, via: 'routes_to', kind: 'routes_to', line: route.line })
              }
            }
          }
        }
      }
    } else if (startRel.endsWith('.ts')) {
      const cts = readSafe(abs) || ''
      const meta = extractComponentMeta(cts)
      for (const c of extractCalls(cts)) {
        const depType = meta.di[c.receiverVar]
        if (!depType) continue
        const serviceFile = r.resolveClassFile(depType)
        if (!serviceFile) continue
        push({ path: serviceFile, symbol: `${depType}.${c.method}`, via: 'calls', kind: 'calls', line: c.line })
        const sts = r.readRel(serviceFile) || ''
        const srange = findMethodRange(sts, c.method)
        for (const route of extractRoutes(sts, srange || undefined)) {
          push({ path: serviceFile, symbol: `${route.verb} ${route.path}`, via: 'routes_to', kind: 'routes_to', line: route.line })
        }
      }
    }
  } catch { /* partial chain */ }
  return chain
}
