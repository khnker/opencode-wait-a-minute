import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { selectContextWithCqe } from '../../../src/context/context.js';

let sqliteAvailable = false;
try {
  createRequire(import.meta.url)('node:sqlite');
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

test('CQE integration in selectContextWithCqe', { skip: sqliteAvailable ? false : 'requiere runtime con node:sqlite (node >=22.5); en este runtime CQE degrada a nativo por diseño' }, async () => {
  const root = makeFixtureRepo();
  process.env.WAM_CQE_MODE = 'enabled';

  try {
    const pkg = await selectContextWithCqe('FIND definitions OF symbol parseConfig', {
      budget: 8000,
      root,
    });

    assert.ok(Array.isArray(pkg.file_context), 'file_context should be populated');
    assert.ok(pkg.file_context.length > 0, 'file_context should not be empty');
    assert.ok(pkg.rationale.some(r => r.startsWith('CQE:')), 'rationale should include CQE info');
  } finally {
    cleanupRepo(root);
  }
});
