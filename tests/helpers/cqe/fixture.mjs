import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_SRC = path.resolve(HERE, '../../fixtures/cqe/sample-repo');

export function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-cqe-fixture-'));
  fs.cpSync(FIXTURE_SRC, dir, { recursive: true });
  return dir;
}

export function cleanupRepo(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}
