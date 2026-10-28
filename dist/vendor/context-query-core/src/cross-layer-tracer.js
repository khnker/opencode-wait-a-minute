import path from 'node:path';
import { walkSourceFiles, readSafe, COUPLING_EDGE_KINDS } from './coupling-tracer.js';

export const CROSS_LAYER_EDGE_KINDS = [...COUPLING_EDGE_KINDS, 'serves', 'persists', 'dispatches'];

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

export function normalizeRoutePath(p) {
  return String(p || '')
    .replace(/\?.*$/, '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')
    .replace(/^([^/])/, '/$1');
}

export function matchUrlToRoute(url, routes) {
  const normUrl = normalizeRoutePath(url);
  let best = null;
  let maxScore = -1;
  for (const route of routes) {
    const normRoute = normalizeRoutePath(route.path);
    if (normUrl === normRoute) return { route, score: 1.0 };
    const paramRegex = normRoute.replace(/:\w+|[[{]\w+[}\]]|\*/g, '[^/]+');
    if (new RegExp(`^${paramRegex}$`).test(normUrl)) {
      if (0.8 > maxScore) {
        maxScore = 0.8;
        best = { route, score: 0.8 };
      }
    }
  }
  return best || { route: null, score: 0.0 };
}

export function classifyLayer(relPath) {
  const p = String(relPath || '').toLowerCase();
  if (p.includes('bff/')) return 'bff';
  if (p.includes('fe/') || p.includes('web/') || p.includes('apps/web/') || p.includes('.component.')) return 'frontend';
  if (p.includes('daemon/') || p.includes('worker/') || p.includes('server/')) return 'microservice';
  if (p.includes('db/') || p.includes('migrations/') || p.includes('.entity.') || p.includes('schema.prisma') || p.includes('repository')) return 'db';
  if (p.includes('api/') || p.includes('apps/api/') || p.includes('packages/api/') || p.includes('controller') || p.includes('route')) return 'api';
  return 'service';
}

export function extractServerRoutes(source) {
  const out = [];
  for (const m of source.matchAll(/@Controller\(['"]([^'"]+)['"]\)/g)) {
    const base = m[1];
    const rest = source.slice(m.index);
    for (const m2 of rest.matchAll(/@(Get|Post|Put|Delete|Patch)\(['"]([^'"]+)['"]\)/g)) {
      const routePath = `${base}/${m2[2]}`.replace(/\/+/g, '/');
      const after = rest.slice(m2.index + m2[0].length);
      const handlerMatch = /([A-Za-z_$][\w$]*)\s*\(/.exec(after);
      out.push({
        method: m2[1].toUpperCase(),
        path: routePath,
        handler: handlerMatch ? handlerMatch[1] : null,
        line: lineOf(source, m.index + m2.index),
        framework: 'nestjs'
      });
    }
  }
  for (const m of source.matchAll(/(?:app|router)\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g)) {
    out.push({
      method: m[1].toUpperCase(),
      path: m[2],
      handler: null,
      line: lineOf(source, m.index),
      framework: 'hono/express'
    });
  }
  return out;
}

export function extractPersistence(source) {
  const out = [];
  for (const m of source.matchAll(/prisma\.([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)\(/g)) {
    out.push({ target: m[1], op: m[2], line: lineOf(source, m.index), orm: 'prisma' });
  }
  for (const m of source.matchAll(/(?:dataSource\.)?getRepository\(([^)]+)\)/g)) {
    out.push({ target: m[1].trim(), op: 'repository', line: lineOf(source, m.index), orm: 'typeorm' });
  }
  for (const m of source.matchAll(/@Entity\(['"]([^'"]+)['"]\)/g)) {
    out.push({ target: m[1], op: 'entity', line: lineOf(source, m.index), orm: 'typeorm' });
  }
  for (const m of source.matchAll(/\.query\(['"]([^'"]*(SELECT|INSERT|UPDATE|DELETE)[^'"]*)['"]/gi)) {
    const table = /\b(?:FROM|INTO|UPDATE)\s+([A-Za-z_][\w.]*)/i.exec(m[1]);
    out.push({ target: table ? table[1] : 'table', op: m[2].toUpperCase(), line: lineOf(source, m.index), orm: 'sql' });
  }
  return out;
}

export function extractDispatches(source) {
  const out = [];
  for (const m of source.matchAll(/(fetch|axios\.(?:get|post|put|delete|patch)|http\.(?:get|post|put|delete|patch))\(['"]([^'"]+)['"]/g)) {
    if (!m[2].startsWith('/api')) {
      out.push({ target: m[2], kind: 'dispatches', line: lineOf(source, m.index) });
    }
  }
  for (const m of source.matchAll(/(?:spawn|exec|new Queue|redis\.(?:createClient|lpush)|\.emit)\(/g)) {
    out.push({ target: m[0], kind: 'dispatches', line: lineOf(source, m.index) });
  }
  return out;
}

export function traceCrossLayer({ repoRoot, start, url, depth = 4 } = {}) {
  const chain = [];
  const seen = new Set();
  const push = (node) => {
    const key = `${node.path}:${node.symbol || ''}:${node.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    chain.push(node);
    return true;
  };
  try {
    const urls = [];
    if (url) urls.push(url);
    else if (start) {
      const src = readSafe(path.isAbsolute(start) ? start : path.join(repoRoot, start));
      if (src) {
        for (const m of src.matchAll(/['"`](\/api[^'"`$]+)['"`]/g)) urls.push(m[1]);
        const base = /(?:BASE_URL|baseUrl|apiUrl|API_BASE|API_URL)\s*=\s*['"`]([^'"`]+)['"`]/.exec(src);
        if (base) {
          for (const m of src.matchAll(/`([^`]*)`/g)) {
            const seg = m[1].replace(/\$\{[^}]*\}/g, '');
            if (seg.startsWith('/')) urls.push(base[1] + seg);
          }
        }
      }
    }
    if (!urls.length) return chain;

    const beRoutes = [];
    for (const f of walkSourceFiles(repoRoot)) {
      const src = readSafe(path.join(repoRoot, f));
      if (!src) continue;
      for (const r of extractServerRoutes(src)) beRoutes.push({ ...r, file: f });
    }

    const visited = new Set();
    const traceFromUrl = (u, remaining) => {
      if (remaining < 0 || visited.has(u)) return;
      visited.add(u);
      const match = matchUrlToRoute(u, beRoutes);
      if (!match.route) return;
      const r = match.route;
      if (start) push({ path: start, kind: 'routes_to', via: 'http', line: 1, layer: classifyLayer(start) });
      push({ path: r.file, symbol: r.handler || undefined, kind: 'serves', via: 'http', line: r.line, layer: classifyLayer(r.file), framework: r.framework });
      const src = readSafe(path.join(repoRoot, r.file));
      if (!src) return;
      for (const p of extractPersistence(src)) {
        push({ path: r.file, symbol: p.target, kind: 'persists', via: p.orm, line: p.line, layer: 'db' });
      }
      for (const d of extractDispatches(src)) {
        push({ path: r.file, symbol: d.target, kind: 'dispatches', via: 'http', line: d.line, layer: 'microservice' });
        if (d.target.startsWith('/')) traceFromUrl(d.target, remaining - 1);
      }
    };

    for (const u of urls) traceFromUrl(u, depth);
  } catch {
    return chain;
  }
  return chain;
}
