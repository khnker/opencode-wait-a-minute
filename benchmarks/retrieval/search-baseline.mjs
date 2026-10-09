/**
 * Baseline search using ripgrep (rg) and GitGrep.
 * Deterministic, offline, no model calls.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Search query using rg --json -n for each repo root.
 * Fallback to git grep -n if rg not found.
 * Then bounded recursive fs scan for line matches.
 * Deterministic ordering by path then line number.
 * Never throws; returns empty array on no matches.
 *
 * @param {string} query - Plain text search term.
 * @param {{repoRoot:string, maxResults?:number}} opts
 * @returns {Array<{path:string,content:string,startLine:number,score:number}>}
 */
export function searchBaseline(query, { repoRoot, maxResults = 5 } = {}) {
  // Try ripgrep first
  if (isRgAvailable()) {
    const rg = runRg(query, repoRoot);
    if (rg.success && rg.results.length > 0) {
      const items = rg.results.map(r => ({
        path: r.path,
        content: r.text,
        startLine: Number(r.line_number),
        score: 1.0,
      }));
      // Apply maxResults and stable sort
      return stableSortAndLimit(items, maxResults);
    }
  }

  // Try git grep if rg missing or empty
  if (isGitGrepAvailable()) {
    const git = runGitGrep(query, repoRoot);
    if (git.results.length > 0) {
      const items = git.results.map(r => ({
        path: r.path,
        content: r.match,
        startLine: Number(r.line),
        score: 1.0,
      }));
      return stableSortAndLimit(items, maxResults);
    }
  }

  // Fallback: bounded recursive scan for line matches
  const fsResults = scanFsForMatches(query, repoRoot);
  return stableSortAndLimit(fsResults, maxResults);
}

function isRgAvailable() {
  try {
    const r = spawnSync('rg', ['--version'], { encoding: 'utf8', stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

function isGitGrepAvailable() {
  try {
    const r = spawnSync('git', ['--version'], { encoding: 'utf8', stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

function runRg(query, repoRoot) {
  const r = spawnSync('rg', ['--json', '-n', '--max-filesize', '1m', query, repoRoot], {
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    return { success: false, results: [] };
  }
  const results = [];
  for (const line of r.stdout.split('\n')) {
    if (!line) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (e) {
      continue;
    }
    if (entry.type !== 'match') continue;
    const rawPath = entry.data?.path?.text || '';
    results.push({
      path: path.relative(repoRoot, rawPath) || rawPath,
      text: (entry.data?.lines?.text || '').replace(/\n$/, ''),
      line_number: entry.data?.line_number,
    });
  }
  return { success: results.length > 0, results };
}

function runGitGrep(query, repoRoot) {
  const r = spawnSync('git', ['grep', '-n', '-F', query, '--', '.'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (r.status !== 0) {
    return { results: [] };
  }
  const out = r.stdout.trim().split('\n');
  const results = out.filter(l => l).map(l => {
    // git grep format: path:line:match
    const [path, line, ...rest] = l.split(':');
    return { path, line, match: rest.join(':') };
  }).filter(item => !isIgnored(item.path, repoRoot));
  return { results };
}

function isIgnored(relPath, repoRoot) {
  if (!relPath) return false;
  const r = spawnSync('git', ['check-ignore', '-q', '--', relPath], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  return r.status === 0;
}

function scanFsForMatches(query, repoRoot) {
  const items = [];
  const normalize = (p) => path.normalize(p);
  const seen = new Set();
  const ignorePatterns = loadIgnorePatterns(repoRoot);
  try {
    for (const dir of [repoRoot]) {
      const walk = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dirPath, e.name);
          const rel = path.relative(repoRoot, full);
          if (isIgnoredByPatterns(rel, ignorePatterns)) continue;
          if (e.isDirectory()) {
            // Limit depth to 3 and skip large directories
            if (!e.name.includes('.') && !e.name.startsWith('.')) {
              walk(full);
            }
            continue;
          }
          // Skip binary files
          const stat = fs.statSync(full);
          if (!stat.isFile()) continue;
          const ext = path.extname(e.name);
          if (['.js', '.json', '.md', '.txt', '.yml', '.yaml', '.toml'].includes(ext.toLowerCase())) {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.includes(query)) {
                const key = normalize(full) + ':' + i;
                if (seen.has(key)) continue;
                seen.add(key);
                items.push({ path: rel, content: line, startLine: i + 1, score: 0.5 });
              }
            }
          }
        }
      };
      walk(dir);
    }
  } catch (e) {
    // ignore errors (permissions, etc.)
  }
  return items;
}

function loadIgnorePatterns(repoRoot) {
  const patterns = [];
  try {
    const content = fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      patterns.push(line.replace(/\/$/, ''));
    }
  } catch (e) {
    // no .gitignore
  }
  return patterns;
}

function isIgnoredByPatterns(relPath, patterns) {
  if (!relPath) return false;
  const parts = relPath.split(path.sep);
  return patterns.some(p => parts.includes(p) || relPath === p || relPath.startsWith(p + path.sep));
}

function stableSortAndLimit(items, limit) {
  // Stable sort by relative path then line number
  items.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.startLine - b.startLine;
  });
  return items.slice(0, limit);
}
