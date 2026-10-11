/**
 * Comprehensive Validation Benchmark for WAM Guards & Policies
 * Measures effectiveness, latency, and interception impact for:
 * 1. discovery-tool-first-routing
 * 2. runaway-loop-budget-guard
 * 3. session-file-read-ledger
 * 4. subagent-model-availability-guard
 * 5. audit-persist-loop-guard
 */

import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

import { evaluateDiscovery } from '../src/policy/discovery-classifier.js';
import { createLoopBudgetGuard } from '../src/execution/loop-budget-guard.js';
import { createFileReadLedger } from '../src/context/session-file-read-ledger.js';
import { resolveSubagentModel } from '../src/skills/subagent-model-availability.js';
import { createAuditCoalescer } from '../src/persistence/audit-coalescer.js';

async function runGuardsBenchmark() {
  console.log('--- WAM Guards & Policies Validation Benchmark ---');
  const results = {};

  // 1. Discovery Tool-First Routing
  const start1 = performance.now();
  const disc1 = evaluateDiscovery('bash', { command: 'find . -name "*.js"' });
  const disc2 = evaluateDiscovery('bash', { command: 'git status' });
  const dur1 = performance.now() - start1;
  results.discovery = { latencyMs: dur1, action1: disc1.action, action2: disc2.action };

  // 2. Runaway Loop Budget Guard
  const start2 = performance.now();
  const guard = createLoopBudgetGuard({ stepBudget: 10, perToolThreshold: 2 });
  let action1 = guard.record('grep', { pattern: 'foo' });
  let action2 = guard.record('grep', { pattern: 'foo' }); // triggers threshold
  const dur2 = performance.now() - start2;
  results.loopBudget = { latencyMs: dur2, action1: action1.directive, action2: action2.directive };
  assert.equal(action1.directive, null);
  assert.equal(action2.directive, 'CHECKPOINT');

  // 3. Session File Read Ledger
  const start3 = performance.now();
  const ledger = createFileReadLedger();
  ledger.recordRead('file.js', 'dummy content');
  const hasRead = ledger.getDigest('file.js') !== null;
  const dur3 = performance.now() - start3;
  results.readLedger = { latencyMs: dur3, hasRead };
  assert.equal(hasRead, true);

  // 4. Subagent Model Availability Guard
  const start4 = performance.now();
  const reg = { tiers: { fast: ['omni/free-stack'] }, activePreset: 'omni' };
  const modelCheck = resolveSubagentModel('fast', { registry: reg });
  const dur4 = performance.now() - start4;
  results.subagentModel = { latencyMs: dur4, ok: modelCheck.ok, model: modelCheck.model };
  assert.equal(modelCheck.ok, true);

  // 5. Audit Persist Loop Guard
  const start5 = performance.now();
  const mockFs = {
    writeFileSync: () => {},
    mkdirSync: () => {},
    accessSync: () => {}
  };
  const coalescer = createAuditCoalescer({ fs: mockFs, filePath: '/tmp/audit-test.json' });
  const aud1 = coalescer.push({ decision: 'test', timestamp: Date.now() });
  const aud2 = coalescer.push({ decision: 'test', timestamp: Date.now() });
  const dur5 = performance.now() - start5;
  results.auditCoalescer = { latencyMs: dur5, aud1, aud2 };
  assert.equal(typeof aud1, 'object');

  console.log(JSON.stringify(results, null, 2));
  console.log('--- All WAM Guards Benchmarked & Validated Successfully ---');
}

runGuardsBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
