import fs from 'fs';
import path from 'path';

/**
 * Canonical absolute path for a repository root. Resolving symlinks here keeps
 * every alias of the same repo (symlink, `..`, trailing slash) on one engine.
 */
export function canonicalRoot(candidate) {
  if (!candidate) return null;
  const resolved = path.resolve(candidate);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

/**
 * Resolve a CQE-provided path against the authorized repo root.
 * Returns the canonical real path only when it stays inside the root.
 */
export function validatePath(candidate, repoRoot) {
  if (!candidate) return null;

  const root = canonicalRoot(repoRoot);
  if (!root) return null;

  const resolved = path.resolve(root, candidate);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'EACCES')) return null;
    return null;
  }

  const rel = path.relative(root, real);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return real;
  return null;
}
