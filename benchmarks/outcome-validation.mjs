import { evaluateOutcome, OUTCOME_STATUSES } from '../src/verification/outcome-evaluator.js';

console.log('=== Outcome Validation Benchmark ===');

const contract = {
  taskId: 'task-101',
  objective: 'Implement user login feature',
  acceptanceCriteria: [
    { id: 'c1', description: 'User can submit login form', mandatory: true },
    { id: 'c2', description: 'JWT token is returned on success', mandatory: true },
  ],
};

const base = Date.now();

// Test Case 1: Code modified, tests pass, outcome achieved
const res1 = evaluateOutcome(
  contract,
  [
    { criterionId: 'c1', status: 'VERIFIED', timestamp: base },
    { criterionId: 'c2', status: 'VERIFIED', timestamp: base + 1 },
  ],
  []
);
const pass1 = res1.status === OUTCOME_STATUSES.ACHIEVED && res1.canComplete === true;
console.log(`[${pass1 ? 'PASS' : 'FAIL'}] Code modified, tests pass, outcome achieved`);
console.log(`  Expected: status=ACHIEVED, canComplete=true`);
console.log(`  Actual:   status=${res1.status}, canComplete=${res1.canComplete}`);

// Test Case 2: Code modified, tests pass, but objective not achieved (evidence shows failure)
const res2 = evaluateOutcome(
  contract,
  [
    { criterionId: 'c1', status: 'VERIFIED', timestamp: base },
    { criterionId: 'c2', status: 'FAILED', timestamp: base + 1 },
  ],
  []
);
const pass2 = res2.status === OUTCOME_STATUSES.NOT_ACHIEVED && res2.canComplete === false;
console.log(`[${pass2 ? 'PASS' : 'FAIL'}] Code modified, tests pass, but objective not achieved`);
console.log(`  Expected: status=NOT_ACHIEVED, canComplete=false`);
console.log(`  Actual:   status=${res2.status}, canComplete=${res2.canComplete}`);

// Test Case 3: Action completed without evidence
const res3 = evaluateOutcome(contract, [], []);
const pass3 = res3.status === OUTCOME_STATUSES.UNVERIFIED && res3.canComplete === false;
console.log(`[${pass3 ? 'PASS' : 'FAIL'}] Action completed without evidence`);
console.log(`  Expected: status=UNVERIFIED, canComplete=false`);
console.log(`  Actual:   status=${res3.status}, canComplete=${res3.canComplete}`);

const totalPass = (pass1 ? 1 : 0) + (pass2 ? 1 : 0) + (pass3 ? 1 : 0);
console.log(`\nResults: ${totalPass}/3 test cases passed.`);
if (totalPass < 3) process.exit(1);
