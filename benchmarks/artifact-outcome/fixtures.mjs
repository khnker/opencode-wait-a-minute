// Repository fixtures isolation for the artifact-outcome benchmark.
//
// Every fixture lives under the OS temp dir and is tagged with FIXTURE_PREFIX.
// The real workspace is never touched: all writes are constrained to a fixture
// root and cleanup refuses to remove anything that is not a tagged fixture.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

export const FIXTURE_PREFIX = 'wam-artifact-outcome-';

/**
 * Create an isolated fixture repository under the OS temp dir.
 * @param {string} [label] short label used in the directory name
 * @returns {string} absolute fixture root
 */
export function createFixtureRepo(label = 'repo') {
  const root = mkdtempSync(join(tmpdir(), `${FIXTURE_PREFIX}${label}-`));
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  return root;
}

/**
 * True only for paths that are tagged fixtures inside the OS temp dir.
 * Used both to keep writes contained and to make cleanup safe.
 * @param {string} value
 * @returns {boolean}
 */
export function isFixturePath(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const resolved = resolve(value);
  const tmpRoot = resolve(tmpdir());
  return resolved.startsWith(tmpRoot + sep) && resolved.includes(FIXTURE_PREFIX);
}

/**
 * Remove a fixture root. Refuses non-fixture paths so a bug can never delete
 * real repository content.
 * @param {string} root
 */
export function cleanupFixtureRepo(root) {
  if (!isFixturePath(root)) {
    throw new Error(`refusing to remove non-fixture path: ${String(root)}`);
  }
  rmSync(root, { recursive: true, force: true });
}

/**
 * Write a file relative to a fixture root, refusing path escapes.
 * @param {string} root
 * @param {string} relPath
 * @param {string} content
 * @returns {string} absolute path written
 */
export function writeFixtureFile(root, relPath, content) {
  const rootAbs = resolve(root);
  const abs = resolve(rootAbs, relPath);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) {
    throw new Error(`refusing to write outside fixture root: ${relPath}`);
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
  return abs;
}

export function fixtureFileExists(root, relPath) {
  return existsSync(resolve(root, relPath));
}
