/**
- Guard Metrics & Value Benchmark
- Measures efficacy and overhead of WAM runtime guards:
  1. Loop Budget Guard
  2. Session File Read Ledger
  3. Subagent Model Availability Guard
  4. Audit Coalescer
 */

import assert from 'node:assert/strict';
import { checkLoopBudget } from '../src/execution/loop-budget-guard.js';
import { recordRead, hasRead } from '../src/context/session-file-read-ledger.js';
import { validateSubagentModel } from '../src/skills/subagent-model-availability.js';
import { coalesceAudit } from '../src/persistence/audit-coalescer.js';

async function runGuardBenchmarks() {
  console.log('--- Running Guard Metrics & Value Benchmark ---');

  // 1. Loop Budget Guard
  const startLoop = performance.now();
  const budgetCheck = checkLoopBudget({ iterations: 3, maxIterations: 5 });
  const loopElapsed = performance.now() - startLoop;
  assert.equal(budgetCheck.ok, true);
  console.log(`[Loop Budget Guard] Passed in ${loopElapsed.toFixed(2)}ms (Enforces iteration limits)`);

  // 2. Session File Read Ledger
  const startLedger = performance.now();
  const fileKey = 'src/index.js';
  const firstRead = !hasRead('session-1', fileKey);
  recordRead('session-1', fileKey);
  const duplicateRead = hasRead('session-1', fileKey);
  const ledgerElapsed = performance.now() - startLedger;
  assert.equal(firstRead, true);
  assert.equal(duplicateRead, true);
  console.log(`[Session Read Ledger] Passed in ${ledgerElapsed.toFixed(2)}ms (Eliminates duplicate file reads)`);

  // 3. Subagent Model Availability Guard
  const startModel = performance.now();
  const modelCheck = validateSubagentModel('fast', { availableModels: ['omni/free-stack'] });
  const modelElapsed = performance.now() - startModel;
  assert.equal(modelCheck.ok, true);
  console.log(`[Subagent Model Guard] Passed in ${modelElapsed.toFixed(2)}ms (Ensures valid model binding)`);

  // 4. Audit Coalescer
  const startAudit = performance.now();
  const auditResult = coalesceAudit({ decision: 'test', timestamp: Date.now() });
  const auditElapsed = performance.now() - startAudit;
  assert.equal(auditResult.coalesced, true);
  console.log(`[Audit Coalescer] Passed in ${auditElapsed.toFixed(2)}ms (Coalesces writes, prevents disk thrashing)`);

  console.log('--- All Guard Benchmarks Passed Successfully ---');
}

runGuardBenchmarks();
