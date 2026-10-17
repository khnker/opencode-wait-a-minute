import test from 'node:test';
import assert from 'node:assert/strict';
import { readLedger } from './session-file-read-ledger.js';
import { guardAction } from '../execution/runtime-guards.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('Ledger dedup', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello');
    
    readLedger.recordRead(filePath, 'hello');
    assert.strictEqual(readLedger.isRedundant(filePath, 'hello'), true);
    assert.strictEqual(readLedger.isRedundant(filePath, 'world'), false);
    
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Ledger stale detection', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'hello');
    
    readLedger.recordRead(filePath, 'hello');
    assert.strictEqual(readLedger.checkStale(filePath, 'world'), true);
    assert.strictEqual(readLedger.checkStale(filePath, 'hello'), false);
    
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Stale edit guard', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'version 1');
    
    // Read to record
    readLedger.recordRead(filePath, 'version 1');
    
    // Change file content on disk
    fs.writeFileSync(filePath, 'version 2');
    
    // Try to edit - should be blocked
    const res = await guardAction('edit', { filePath }, tmpDir, 'task-1');
    assert.strictEqual(res.allowed, false, 'Should be blocked');
    assert.strictEqual(res.level, 'BLOCKED');
    
    // Fresh case
    readLedger.recordRead(filePath, 'version 2');
    const resFresh = await guardAction('edit', { filePath }, tmpDir, 'task-1');
    assert.strictEqual(resFresh.allowed, true, 'Should be allowed');
    
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Ledger error fallback', () => {
    assert.doesNotThrow(() => {
        assert.strictEqual(readLedger.isRedundant('nonexistent', 'content'), false);
        assert.strictEqual(readLedger.getDigest('nonexistent'), null);
    });
});
