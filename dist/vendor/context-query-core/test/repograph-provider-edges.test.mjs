import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isExcludedPath, createDefaultProvider, RepographProvider } from '../src/repograph-provider.js';

test('isExcludedPath excludes generated, vendored, and ignored paths', () => {
  assert.equal(isExcludedPath('node_modules/pkg/index.js'), true);
  assert.equal(isExcludedPath('/repo/.git/config'), true);
  assert.equal(isExcludedPath('vendor/repograph/dist/index.js'), true);
  assert.equal(isExcludedPath('dist/bundle.js'), true);
  assert.equal(isExcludedPath('build/out.js'), true);
  assert.equal(isExcludedPath('coverage/lcov.info'), true);
});

test('isExcludedPath keeps normal source paths', () => {
  assert.equal(isExcludedPath('src/app.ts'), false);
  assert.equal(isExcludedPath('lib/utils.mjs'), false);
  assert.equal(isExcludedPath('packages/api/controller.ts'), false);
});

test('isExcludedPath handles empty/invalid input', () => {
  assert.equal(isExcludedPath(''), false);
  assert.equal(isExcludedPath(null), false);
  assert.equal(isExcludedPath(undefined), false);
});

test('createDefaultProvider returns a RepographProvider instance', () => {
  const p = createDefaultProvider({ repoRoot: '/tmp/repo' });
  assert.ok(p instanceof RepographProvider);
  assert.equal(p.repoRoot, '/tmp/repo');
  assert.equal(p.autoIndex, true);
  assert.ok(Array.isArray(p.ignorePatterns));
  assert.ok(p.ignorePatterns.length > 0);
});

test('createDefaultProvider defaults to cwd and custom options', () => {
  const p = createDefaultProvider({});
  assert.equal(p.repoRoot, process.cwd());
  const custom = createDefaultProvider({ repoRoot: '/tmp/r', autoIndex: false, staleCheckMs: 1234 });
  assert.equal(custom.autoIndex, false);
  assert.equal(custom.staleCheckMs, 1234);
});

test('RepographProvider reports unavailable when vendored core is missing', async () => {
  const p = new RepographProvider({
    repoRoot: '/tmp/does-not-exist-repo',
    coreDir: '/tmp/definitely-not-a-repograph-core',
    autoIndex: false
  });
  const st = await p.getStatus();
  assert.equal(st.available, false);
  assert.ok(typeof st.reason === 'string');
  assert.ok(st.reason.length > 0);
});

test('RepographProvider returns empty results when core is missing', async () => {
  const p = new RepographProvider({
    repoRoot: '/tmp/does-not-exist-repo',
    coreDir: '/tmp/definitely-not-a-repograph-core',
    autoIndex: false
  });
  assert.deepStrictEqual(await p.findSymbols('anything'), []);
  assert.deepStrictEqual(await p.getRelationships('sym'), []);
  assert.deepStrictEqual(await p.getFileRelationships('src/a.ts'), []);
});
