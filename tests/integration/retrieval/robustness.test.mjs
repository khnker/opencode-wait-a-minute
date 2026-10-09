import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

/**
 * Test that prompt injection in a file is treated as inert data (content string, never executed).
 */
test('robustness - prompt injection treated as data', async () => {
  const tempDir = fs.mkdtempSync(path.join(fs.realpathSync('.'), 'tmp-fixture'));
  try {
    // Create a file with prompt injection text
    const injectionFile = path.join(tempDir, 'malicious.js');
    const injectionText = 'const payload = () => { throw new Error("injected"); };';
    fs.writeFileSync(injectionFile, injectionText);

    // Use baseline search to retrieve it (should return content as a string)
    const { searchBaseline } = await import('../../../benchmarks/retrieval/search-baseline.mjs');
    const results = searchBaseline('payload', { repoRoot: tempDir, maxResults: 5 });

    // The content should be the line containing "payload", not an executed function
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].content.trim(), injectionText);
    // No exception should be thrown
    assert.ok(true, 'Prompt injection treated as inert data');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

/**
 * Test contradiction detection (two conflicting evidence files).
 */
test('robustness - contradiction detection', async () => {
  const tempDir = fs.mkdtempSync(path.join(fs.realpathSync('.'), 'tmp-fixture'));
  try {
    // Create two files with conflicting content about the same symbol
    const file1 = path.join(tempDir, 'a.js');
    const file2 = path.join(tempDir, 'b.js');
    fs.writeFileSync(file1, 'const x = 1;');
    fs.writeFileSync(file2, 'const x = 2;');

    const { searchBaseline } = await import('../../../benchmarks/retrieval/search-baseline.mjs');
    const results = searchBaseline('const x', { repoRoot: tempDir, maxResults: 5 });

    // Both files should be returned (contradiction evidence)
    assert.strictEqual(results.length, 2);
    const names = results.map(r => path.basename(r.path));
    assert.ok(names.includes('a.js'));
    assert.ok(names.includes('b.js'));
    assert.ok(true, 'Contradiction detection returned both evidence files');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

/**
 * Test absence detection (missing symbol).
 */
test('robustness - absence detection distinguishable via metadata', async () => {
  const tempDir = fs.mkdtempSync(path.join(fs.realpathSync('.'), 'tmp-fixture'));
  try {
    // Use CQE retrieval
    const { retrieveWithCqe } = await import('../../../src/context/cqe-adapter.js');
    const result = await retrieveWithCqe('definitelyNotExistsXYZ', {
      repoRoot: tempDir,
      mode: 'enabled',
      maxResults: 5,
    });

    // Should be distinguishable: either empty result with metadata.empty = true or fallbackUsed
    // For fixture, CQE might return fallbackUsed:true with metadata.empty:true
    // or return result with source:'wam-native' and metadata.empty:true
    if (result.fallbackUsed) {
      assert.ok(result.metadata?.empty === true || result.metadata?.fallbackReason?.includes('empty'),
        'Fallback used with empty indication for absent query');
    } else {
      assert.strictEqual(result.items.length, 0, 'Empty results for absent query');
    }
    assert.ok(true, 'Absence detection distinguishable via metadata');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

/**
 * Test scope respect (no files from outside repoRoot leak).
 */
test('robustness - scope respect (repoRoot isolation)', async () => {
  const tempDir = fs.mkdtempSync(path.join(fs.realpathSync('.'), 'tmp-fixture'));
  try {
    // Create a file with search term inside
    const insideFile = path.join(tempDir, 'inside.js');
    fs.writeFileSync(insideFile, 'target = 42');

    // Create a file outside (in parent)
    const outsideFile = path.join(path.dirname(tempDir), 'outside.js');
    fs.writeFileSync(outsideFile, 'target = 99');

    const { searchBaseline } = await import('../../../benchmarks/retrieval/search-baseline.mjs');
    const results = searchBaseline('target', { repoRoot: tempDir, maxResults: 5 });

    // Should only contain insideFile, not outsideFile
    assert.strictEqual(results.length, 1);
    assert.strictEqual(path.basename(results[0].path), 'inside.js');
    assert.strictEqual(results[0].content, 'target = 42');
    assert.ok(true, 'Scope respected: no files from outside repoRoot leaked');
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(path.dirname(tempDir), 'outside.js'))) {
      fs.unlinkSync(path.join(path.dirname(tempDir), 'outside.js'));
    }
  }
});
