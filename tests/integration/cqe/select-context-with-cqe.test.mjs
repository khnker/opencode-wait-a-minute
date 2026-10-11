import test from 'node:test';
import assert from 'node:assert';
import { makeFixtureRepo, cleanupRepo } from '../../helpers/cqe/fixture.mjs';
import { selectContextWithCqe } from '../../../src/context/context.js';

test('RT-01: file-search prompt augments the package with CQE file_context', async () => {
  const dir = makeFixtureRepo();
  try {
    const pkg = await selectContextWithCqe('FIND definitions OF symbol parseConfig', {
      root: dir,
    });
    assert.ok(Array.isArray(pkg.file_context), 'expected file_context array');
    assert.ok(pkg.file_context.length > 0, 'expected CQE to retrieve fixture matches');
    assert.ok(
      pkg.rationale.some((r) => /CQE: retrieved \d+ file matches/.test(r)),
      `expected CQE rationale, got ${JSON.stringify(pkg.rationale)}`,
    );
  } finally {
    cleanupRepo(dir);
  }
});

test('RT-02: non-search prompt leaves file_context unset (native only)', async () => {
  const dir = makeFixtureRepo();
  try {
    const pkg = await selectContextWithCqe('please summarize the deployment checklist', {
      root: dir,
    });
    assert.ok(!pkg.file_context || pkg.file_context.length === 0);
  } finally {
    cleanupRepo(dir);
  }
});

test('RT-03: disableCqe opt-out suppresses CQE augmentation', async () => {
  const dir = makeFixtureRepo();
  try {
    const pkg = await selectContextWithCqe('FIND definitions OF symbol parseConfig', {
      root: dir,
      disableCqe: true,
    });
    assert.ok(!pkg.file_context || pkg.file_context.length === 0);
  } finally {
    cleanupRepo(dir);
  }
});
