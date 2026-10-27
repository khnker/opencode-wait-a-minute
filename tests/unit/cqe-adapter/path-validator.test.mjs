import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRoot, validatePath } from '../../../src/context/path-validator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.resolve(HERE, '../../fixtures/cqe/sample-repo');

function makeBase() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-path-validator-'));
  const root = path.join(base, 'project');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'file.js'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(base, 'secret.js'), 'secret\n');
  fs.writeFileSync(path.join(base, 'outside.js'), 'outside\n');
  fs.mkdirSync(path.join(base, 'project-evil'));
  fs.writeFileSync(path.join(base, 'project-evil', 'file.js'), 'evil\n');
  return { base, root };
}

test('accepts a real file inside the fixture repo (absolute and relative)', () => {
  const abs = path.join(SAMPLE, 'src', 'config.js');
  assert.strictEqual(validatePath(abs, SAMPLE), fs.realpathSync(abs));
  assert.strictEqual(validatePath('src/config.js', SAMPLE), fs.realpathSync(abs));
});

test('rejects traversal via ..', () => {
  const { base, root } = makeBase();
  try {
    assert.strictEqual(validatePath(path.join(root, '..', 'secret.js'), root), null);
    assert.strictEqual(validatePath('../secret.js', root), null);
    assert.ok(fs.existsSync(path.join(base, 'secret.js')));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects an absolute path outside the root', () => {
  const { base, root } = makeBase();
  try {
    assert.strictEqual(validatePath(path.join(base, 'outside.js'), root), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects a sibling directory sharing the root prefix', () => {
  const { base, root } = makeBase();
  try {
    assert.strictEqual(validatePath(path.join(base, 'project-evil', 'file.js'), root), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects a symlink that escapes the root', () => {
  const { base, root } = makeBase();
  try {
    fs.symlinkSync(path.join(base, 'secret.js'), path.join(root, 'link.js'));
    assert.strictEqual(validatePath('link.js', root), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('rejects a missing file and a null candidate', () => {
  const { base, root } = makeBase();
  try {
    assert.strictEqual(validatePath('src/missing.js', root), null);
    assert.strictEqual(validatePath(null, root), null);
    assert.strictEqual(validatePath('src/file.js', null), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('canonicalRoot resolves a symlinked directory to its real path', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wam-canonical-root-'));
  try {
    const real = path.join(base, 'real');
    const link = path.join(base, 'link');
    fs.mkdirSync(real);
    fs.symlinkSync(real, link, 'dir');
    assert.strictEqual(canonicalRoot(link), fs.realpathSync(real));
    assert.strictEqual(canonicalRoot(link), canonicalRoot(real));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('canonicalRoot falls back to the resolved path when it does not exist', () => {
  const missing = path.join(os.tmpdir(), `wam-canonical-missing-${process.pid}-${Date.now()}`);
  assert.strictEqual(canonicalRoot(missing), path.resolve(missing));
});

test('canonicalRoot returns null for falsy input', () => {
  assert.strictEqual(canonicalRoot(null), null);
  assert.strictEqual(canonicalRoot(undefined), null);
  assert.strictEqual(canonicalRoot(''), null);
});
