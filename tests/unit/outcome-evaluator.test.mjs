import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOutcome, validateOutcomeContract, OUTCOME_STATUSES } from '../../src/verification/outcome-evaluator.js';

test('validateOutcomeContract validates required fields', () => {
  assert.equal(validateOutcomeContract(null).valid, false);
  assert.equal(validateOutcomeContract({}).valid, false);
  assert.equal(validateOutcomeContract({ taskId: 't1' }).valid, false);
  assert.equal(validateOutcomeContract({ taskId: 't1', objective: 'test' }).valid, false);
  assert.equal(
    validateOutcomeContract({
      taskId: 't1',
      objective: 'test',
      acceptanceCriteria: [{ id: 'c1', description: 'works' }],
    }).valid,
    true
  );
});

test('evaluateOutcome returns ACHIEVED when all criteria have verified evidence', () => {
  const contract = {
    taskId: 't1',
    objective: 'Fix bug',
    acceptanceCriteria: [
      { id: 'c1', description: 'Bug fixed' },
    ],
  };
  const evidence = [
    { criterionId: 'c1', status: 'VERIFIED' },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
});

test('evaluateOutcome returns PARTIAL when some criteria lack evidence', () => {
  const contract = {
    taskId: 't1',
    objective: 'Do two things',
    acceptanceCriteria: [
      { id: 'c1', description: 'First' },
      { id: 'c2', description: 'Second' },
    ],
  };
  const evidence = [
    { criterionId: 'c1', status: 'VERIFIED' },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.PARTIAL);
  assert.equal(result.canComplete, false);
});

test('evaluateOutcome returns NOT_ACHIEVED when evidence shows failure', () => {
  const contract = {
    taskId: 't1',
    objective: 'Fail case',
    acceptanceCriteria: [
      { id: 'c1', description: 'Should fail' },
    ],
  };
  const evidence = [
    { criterionId: 'c1', status: 'FAILED' },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.NOT_ACHIEVED);
  assert.equal(result.canComplete, false);
});
