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
  // Reject empty taskId
  assert.equal(validateOutcomeContract({ taskId: '', objective: 'x', acceptanceCriteria: [{ id: 'c1' }] }).valid, false);
  // Reject empty objective
  assert.equal(validateOutcomeContract({ taskId: 't1', objective: '', acceptanceCriteria: [{ id: 'c1' }] }).valid, false);
  // Reject empty criteria array
  assert.equal(validateOutcomeContract({ taskId: 't1', objective: 'x', acceptanceCriteria: [] }).valid, false);
});

test('evaluateOutcome returns ACHIEVED when all mandatory criteria have verified evidence', () => {
  const contract = {
    taskId: 't1',
    objective: 'Fix bug',
    acceptanceCriteria: [{ id: 'c1', description: 'Bug fixed', mandatory: true }],
  };
  const evidence = [{ criterionId: 'c1', status: 'VERIFIED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
});

test('evaluateOutcome returns UNVERIFIED when a mandatory criterion is missing evidence', () => {
  const contract = {
    taskId: 't1',
    objective: 'Do two things',
    acceptanceCriteria: [
      { id: 'c1', description: 'First', mandatory: true },
      { id: 'c2', description: 'Second', mandatory: true },
    ],
  };
  const evidence = [{ criterionId: 'c1', status: 'VERIFIED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.UNVERIFIED);
  assert.equal(result.canComplete, false);
});

test('evaluateOutcome returns NOT_ACHIEVED when evidence shows failure', () => {
  const contract = {
    taskId: 't1',
    objective: 'Fail case',
    acceptanceCriteria: [{ id: 'c1', description: 'Should fail', mandatory: true }],
  };
  const evidence = [{ criterionId: 'c1', status: 'FAILED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.NOT_ACHIEVED);
  assert.equal(result.canComplete, false);
});

test('evaluateOutcome treats optional criteria as non-blocking', () => {
  const contract = {
    taskId: 't1',
    objective: 'Main + stretch',
    acceptanceCriteria: [
      { id: 'c1', description: 'Main', mandatory: true },
      { id: 'c2', description: 'Stretch', mandatory: false },
    ],
  };
  // Only main is verified; stretch is missing
  const evidence = [{ criterionId: 'c1', status: 'VERIFIED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, evidence, []);
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
  assert.equal(result.mandatoryCriteria, 1);
  assert.equal(result.optionalCriteria, 1);
});

test('evaluateOutcome: unverified observation does not satisfy criterion', () => {
  const contract = {
    taskId: 't1',
    objective: 'Obs test',
    acceptanceCriteria: [
      { id: 'c1', description: 'Observed', mandatory: true },
      { id: 'c2', description: 'Second mandatory', mandatory: true },
    ],
  };
  const observations = [{ criterionId: 'c1', status: 'UNVERIFIED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, [], observations);
  assert.equal(result.status, OUTCOME_STATUSES.PARTIAL);
  assert.equal(result.canComplete, false);
});

test('evaluateOutcome: verified observation satisfies criterion', () => {
  const contract = {
    taskId: 't1',
    objective: 'Obs test',
    acceptanceCriteria: [{ id: 'c1', description: 'Observed', mandatory: true }],
  };
  const observations = [{ criterionId: 'c1', status: 'VERIFIED', timestamp: Date.now() }];
  const result = evaluateOutcome(contract, [], observations);
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
});

test('evaluateOutcome: newer verified evidence does NOT override older failed without explicit supersession', () => {
  const contract = {
    taskId: 't1',
    objective: 'Temporal test',
    acceptanceCriteria: [{ id: 'c1', description: 'Fixed', mandatory: true }],
  };
  const old = Date.now() - 10000;
  const now = Date.now();
  const evidence = [
    { criterionId: 'c1', status: 'FAILED', timestamp: old },
    { criterionId: 'c1', status: 'VERIFIED', timestamp: now },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  // Without explicit supersession, failure persists
  assert.equal(result.status, OUTCOME_STATUSES.NOT_ACHIEVED);
  assert.equal(result.canComplete, false);
});

test('evaluateOutcome: explicit supersession allows reverification after failure', () => {
  const contract = {
    taskId: 't1',
    objective: 'Temporal test with supersession',
    acceptanceCriteria: [{ id: 'c1', description: 'Fixed', mandatory: true }],
  };
  const old = Date.now() - 10000;
  const now = Date.now();
  const evidence = [
    { criterionId: 'c1', status: 'FAILED', timestamp: old },
    { criterionId: 'c1', status: 'VERIFIED', timestamp: now, supersedes: true },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  // Explicit supersession allows override
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
});

test('evaluateOutcome: explicit reverifies allows reverification after failure', () => {
  const contract = {
    taskId: 't1',
    objective: 'Temporal test with reverifies',
    acceptanceCriteria: [{ id: 'c1', description: 'Fixed', mandatory: true }],
  };
  const old = Date.now() - 10000;
  const now = Date.now();
  const evidence = [
    { criterionId: 'c1', status: 'FAILED', timestamp: old },
    { criterionId: 'c1', status: 'VERIFIED', timestamp: now, reverifies: true },
  ];
  const result = evaluateOutcome(contract, evidence, []);
  // Explicit reverifies allows override
  assert.equal(result.status, OUTCOME_STATUSES.ACHIEVED);
  assert.equal(result.canComplete, true);
});