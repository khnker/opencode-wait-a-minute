/**
 * Tests for frontend UX outcome evidence integration.
 *
 * Covers the `enforce-frontend-ux-outcome-evidence` spec: criterion-to-evidence
 * association, evidence record completeness, verification sufficiency rules,
 * fail-closed handling of missing evidence, contradiction/supersession
 * preservation, and non-UX passthrough.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UX_VERIFICATION_METHODS,
  UX_METHOD_EVIDENCE_TYPES,
  UX_CLAIM_TYPES,
  UX_CLAIM_SUFFICIENT_METHODS,
  UX_VERIFICATION_STATUS,
  REQUIRED_EVIDENCE_FIELDS,
  getSufficientMethods,
  isUxContract,
  associateCriterionMethods,
  buildUxOutcomeContract,
  validateUxEvidenceContract,
  missingEvidenceFields,
  isCompleteEvidence,
  createUxEvidence,
  isEvidenceSufficient,
  evaluateUxOutcome,
} from './ux-evidence.js';
import { EVIDENCE_STRENGTH } from '../evidence/evidence.js';
import { evaluateOutcome } from '../verification/outcome-evaluator.js';

const uxContract = (criteria, extra = {}) => ({
  taskId: 'ux-task-1',
  objective: 'Improve checkout UX',
  ux: true,
  acceptanceCriteria: criteria,
  ...extra,
});

const criterion = (overrides = {}) => ({
  id: 'c1',
  description: 'Checkout is usable',
  mandatory: true,
  verificationMethods: ['humanEvaluation'],
  claimType: 'usability',
  ...overrides,
});

const complete = (overrides = {}) =>
  createUxEvidence({
    criterionId: 'c1',
    verificationMethod: 'humanEvaluation',
    type: 'USER_CONFIRMATION',
    source: 'usability-session',
    baseline: 'checkout abandoned',
    intendedChange: 'reduce steps',
    observedResult: 'task completed 30% faster',
    reference: 'session-42',
    verified: true,
    ...overrides,
  });

test('verification method taxonomy exposes the four methods', () => {
  assert.deepEqual(UX_VERIFICATION_METHODS, {
    STATIC_ANALYSIS: 'staticAnalysis',
    AUTOMATED_TEST: 'automatedTest',
    VISUAL_INSPECTION: 'visualInspection',
    HUMAN_EVALUATION: 'humanEvaluation',
  });
  assert.deepEqual(Object.keys(UX_METHOD_EVIDENCE_TYPES).sort(), [
    'automatedTest',
    'humanEvaluation',
    'staticAnalysis',
    'visualInspection',
  ]);
  assert.deepEqual(UX_CLAIM_TYPES, {
    STATIC: 'static',
    BEHAVIOR: 'behavior',
    VISUAL: 'visual',
    INTERACTION: 'interaction',
    A11Y: 'a11y',
    USABILITY: 'usability',
  });
});

test('getSufficientMethods encodes the claim-type sufficiency rules', () => {
  assert.deepEqual(getSufficientMethods('usability'), ['humanEvaluation']);
  assert.deepEqual(getSufficientMethods('a11y'), ['humanEvaluation']);
  assert.deepEqual(getSufficientMethods('interaction'), ['automatedTest', 'humanEvaluation']);
  assert.deepEqual(getSufficientMethods('visual'), ['visualInspection']);
  assert.deepEqual(getSufficientMethods('behavior'), ['automatedTest']);
  assert.equal(getSufficientMethods(null), null);
  assert.equal(getSufficientMethods('bogus'), null);
});

test('associateCriterionMethods links a criterion to its declared methods', () => {
  const association = associateCriterionMethods(criterion());
  assert.equal(association.valid, true);
  assert.deepEqual(association.methods, ['humanEvaluation']);
  assert.equal(association.claimType, 'usability');
});

test('associateCriterionMethods derives methods from evidenceRequirements.types', () => {
  const association = associateCriterionMethods({
    id: 'c1',
    evidenceRequirements: { types: ['TEST_RESULT'] },
  });
  assert.equal(association.valid, true);
  assert.deepEqual(association.methods, ['automatedTest']);
});

test('associateCriterionMethods rejects a criterion without verification methods', () => {
  const association = associateCriterionMethods({ id: 'c1', verificationMethods: [] });
  assert.equal(association.valid, false);
  assert.match(association.error, /verification method/);
});

test('validateUxEvidenceContract rejects criteria missing methods or with unknown claim types', () => {
  const noMethods = uxContract([
    { id: 'c1', description: 'd', mandatory: true, claimType: 'visual' },
  ]);
  assert.equal(validateUxEvidenceContract(noMethods).valid, false);

  const badClaim = uxContract([
    { ...criterion(), claimType: 'bogus' },
  ]);
  const result = validateUxEvidenceContract(badClaim);
  assert.equal(result.valid, false);
  assert.match(result.error, /unknown claimType/);

  assert.equal(validateUxEvidenceContract(uxContract([criterion()])).valid, true);
});

test('buildUxOutcomeContract derives allowed evidence types from the methods', () => {
  const normalized = buildUxOutcomeContract(
    uxContract([criterion({ verificationMethods: ['automatedTest'], claimType: 'behavior' })])
  );
  assert.deepEqual(
    [...normalized.acceptanceCriteria[0].evidenceRequirements.types].sort(),
    ['TEST_RESULT', 'TOOL_OUTPUT'].sort()
  );
});

test('createUxEvidence records the association and completeness fields', () => {
  const record = complete();
  assert.equal(record.criterionId, 'c1');
  assert.equal(record.requirementId, 'c1');
  assert.equal(record.verificationMethod, 'humanEvaluation');
  assert.equal(record.baseline, 'checkout abandoned');
  assert.equal(record.intendedChange, 'reduce steps');
  assert.equal(record.observedResult, 'task completed 30% faster');
  assert.equal(record.reference, 'session-42');
  assert.equal(record.verificationStatus, UX_VERIFICATION_STATUS.VERIFIED);
  assert.equal(record.status, 'VERIFIED');
  assert.equal(record.complete, true);
  assert.deepEqual(record.missingFields, []);
  assert.ok(record.timestamp, 'evidence lifecycle timestamp is preserved');
});

test('createUxEvidence reports missing completeness fields, never inferred', () => {
  const record = complete({ intendedChange: '', reference: undefined });
  assert.equal(record.complete, false);
  assert.deepEqual(record.missingFields, ['intendedChange', 'reference']);
  assert.deepEqual(missingEvidenceFields(record), ['intendedChange', 'reference']);
  assert.equal(isCompleteEvidence(record), false);
  assert.deepEqual(REQUIRED_EVIDENCE_FIELDS, [
    'baseline',
    'intendedChange',
    'observedResult',
    'reference',
  ]);
});

test('screenshot (visualInspection) supports visual claims but not usability', () => {
  const screenshot = complete({
    verificationMethod: 'visualInspection',
    type: 'DIRECT',
    reference: 'shot.png',
  });
  const visual = criterion({ verificationMethods: ['visualInspection'], claimType: 'visual' });
  const usability = criterion({
    verificationMethods: ['visualInspection', 'humanEvaluation'],
    claimType: 'usability',
  });
  assert.equal(isEvidenceSufficient(visual, screenshot), true);
  assert.equal(isEvidenceSufficient(usability, screenshot), false);
});

test('code diff (staticAnalysis) does not prove interaction works', () => {
  const diff = complete({ verificationMethod: 'staticAnalysis', type: 'TOOL_OUTPUT' });
  const interaction = criterion({
    verificationMethods: ['staticAnalysis', 'automatedTest'],
    claimType: 'interaction',
  });
  assert.equal(isEvidenceSufficient(interaction, diff), false);
  const automated = complete({ verificationMethod: 'automatedTest', type: 'TEST_RESULT' });
  assert.equal(isEvidenceSufficient(interaction, automated), true);
});

test('a11y scanner result does not establish full a11y compliance', () => {
  const scanner = complete({ verificationMethod: 'staticAnalysis', type: 'TOOL_OUTPUT' });
  const a11y = criterion({
    verificationMethods: ['staticAnalysis', 'humanEvaluation'],
    claimType: 'a11y',
  });
  assert.equal(isEvidenceSufficient(a11y, scanner), false);
});

test('a passing unit test proves only covered behavior', () => {
  const unitTest = complete({ verificationMethod: 'automatedTest', type: 'TEST_RESULT' });
  const behavior = criterion({ verificationMethods: ['automatedTest'], claimType: 'behavior' });
  const usability = criterion({
    verificationMethods: ['automatedTest', 'humanEvaluation'],
    claimType: 'usability',
  });
  assert.equal(isEvidenceSufficient(behavior, unitTest), true);
  assert.equal(isEvidenceSufficient(usability, unitTest), false);
});

test('inferred evidence never substantiates an executed verification', () => {
  const inferred = complete({ strength: EVIDENCE_STRENGTH.L1_INFERENCE });
  assert.equal(isEvidenceSufficient(criterion(), inferred), false);
});

test('missing UX evidence is reported as unverified, not achieved', () => {
  const result = evaluateUxOutcome(uxContract([criterion()]), []);
  assert.equal(result.ux, true);
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.achieved, false);
  assert.equal(result.canComplete, false);
  assert.equal(result.criteriaResults[0].verificationStatus, 'unverified');
  assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].reason, 'NO_EVIDENCE');
});

test('a screenshot alone leaves a usability criterion unverified', () => {
  const contract = uxContract([criterion()]);
  const screenshot = complete({
    verificationMethod: 'visualInspection',
    type: 'DIRECT',
    reference: 'shot.png',
  });
  const result = evaluateUxOutcome(contract, [screenshot]);
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.achieved, false);
  assert.equal(result.criteriaResults[0].verificationStatus, 'unverified');
  assert.equal(result.gaps[0].reason, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(result.gaps[0].insufficientEvidenceIds, [screenshot.id]);
});

test('sufficient human evaluation achieves a UX criterion per WAM contract', () => {
  const result = evaluateUxOutcome(uxContract([criterion()]), [complete()]);
  assert.equal(result.status, 'ACHIEVED');
  assert.equal(result.achieved, true);
  assert.equal(result.canComplete, true);
  assert.equal(result.gaps.length, 0);
  assert.equal(result.criteriaResults[0].verificationStatus, 'verified');
  assert.deepEqual(result.criteriaResults[0].verificationMethods, ['humanEvaluation']);
  assert.equal(result.criteriaResults[0].claimType, 'usability');
});

test('mixed satisfied and unmet criteria are not reported as achieved', () => {
  const contract = uxContract([
    criterion({ id: 'c1' }),
    criterion({
      id: 'c2',
      description: 'Checkout passes a11y review',
      verificationMethods: ['humanEvaluation'],
      claimType: 'a11y',
    }),
  ]);
  const onlyC1 = complete({ criterionId: 'c1' });
  const result = evaluateUxOutcome(contract, [onlyC1]);
  // The shared outcome contract is fail-closed: a satisfied mandatory criterion
  // alongside an unmet one never yields ACHIEVED.
  assert.notEqual(result.status, 'ACHIEVED');
  assert.equal(result.achieved, false);
  assert.equal(result.canComplete, false);
  assert.equal(result.gaps.length, 1);
  assert.equal(result.gaps[0].criterionId, 'c2');
});

test('partial completion is reported accurately', () => {
  const contract = uxContract([
    criterion({ id: 'c1' }),
    criterion({
      id: 'c2',
      description: 'Checkout passes a11y review',
      verificationMethods: ['humanEvaluation'],
      claimType: 'a11y',
    }),
  ]);
  // Partial progress: observations exist, but no mandatory criterion is verified.
  const observation = { id: 'obs-1', criterionId: 'c1', observation: 'reviewer notes', timestamp: 1 };
  const result = evaluateUxOutcome(contract, [], [observation]);
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.achieved, false);
  assert.equal(result.canComplete, false);
  assert.equal(result.gaps.length, 2);
});

test('a failed test blocks the dependent claim', () => {
  const contract = uxContract([
    criterion({ verificationMethods: ['automatedTest'], claimType: 'behavior' }),
  ]);
  const failedTest = complete({
    verificationMethod: 'automatedTest',
    type: 'TEST_RESULT',
    observedResult: 'assertion failed',
    verified: false,
    supports: false,
  });
  const result = evaluateUxOutcome(contract, [failedTest]);
  assert.equal(result.status, 'NOT_ACHIEVED');
  assert.equal(result.achieved, false);
  assert.equal(result.criteriaResults[0].verificationStatus, 'invalid');
  assert.equal(result.gaps[0].reason, 'CONTRADICTED');
});

test('contradictory evidence is preserved and visible', () => {
  const contract = uxContract([criterion()]);
  const positive = complete({ id: 'ev-pos', timestamp: 1 });
  const negative = complete({ id: 'ev-neg', timestamp: 2, verified: false, supports: false });
  const result = evaluateUxOutcome(contract, [positive, negative]);
  assert.equal(result.status, 'NOT_ACHIEVED');
  assert.equal(result.achieved, false);
  assert.equal(result.contradictions.length, 1);
  assert.equal(result.contradictions[0].status, 'UNKNOWN');
  assert.deepEqual(result.contradictions[0].conflictingIds, [positive.id, negative.id]);
  assert.equal(result.evidence.length, 2, 'no evidence record is dropped');
});

test('an explicit supersession restores verification (temporal semantics unchanged)', () => {
  const contract = uxContract([
    criterion({ verificationMethods: ['automatedTest'], claimType: 'behavior' }),
  ]);
  const failed = complete({
    id: 'ev-failed',
    verificationMethod: 'automatedTest',
    type: 'TEST_RESULT',
    verified: false,
    supports: false,
    timestamp: 1000,
  });
  const fixed = complete({
    id: 'ev-fixed',
    verificationMethod: 'automatedTest',
    type: 'TEST_RESULT',
    verified: true,
    supersedes: true,
    timestamp: 2000,
  });
  const result = evaluateUxOutcome(contract, [failed, fixed]);
  assert.equal(result.status, 'ACHIEVED');
  assert.equal(result.achieved, true);
  assert.equal(result.evidence.length, 2);
});

test('non-UX contracts delegate unchanged to the shared outcome evaluator', () => {
  const plain = {
    taskId: 't1',
    objective: 'ship feature',
    acceptanceCriteria: [{ id: 'a', description: 'd', mandatory: true }],
  };
  const evidence = [
    {
      id: 'e1',
      criterionId: 'a',
      type: 'evidence',
      status: 'VERIFIED',
      strength: 'L2_OBSERVATION',
      timestamp: 1,
      verified: true,
    },
  ];
  assert.equal(isUxContract(plain), false);
  assert.equal(isUxContract(uxContract([criterion()])), true);
  const viaUx = evaluateUxOutcome(plain, evidence);
  const viaBase = evaluateOutcome(plain, evidence);
  assert.equal(viaUx.ux, false);
  assert.equal(viaUx.status, viaBase.status);
  assert.equal(viaUx.canComplete, viaBase.canComplete);
  assert.deepEqual(viaUx.criteriaResults, viaBase.criteriaResults);
});

test('an invalid UX contract fails closed as unverified', () => {
  const invalid = uxContract([{ id: 'c1', description: 'd', mandatory: true, claimType: 'visual' }]);
  const result = evaluateUxOutcome(invalid, []);
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.achieved, false);
  assert.ok(result.error);
});
