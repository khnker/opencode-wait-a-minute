/**
 * Outcome Evaluator
 *
 * Implements outcome-based completion: verifying that the requested outcome
 * satisfies acceptance criteria with sufficient traceable evidence, rather than
 * relying solely on task execution or tests finishing.
 */

export const OUTCOME_STATUSES = {
  ACHIEVED: 'ACHIEVED',
  PARTIAL: 'PARTIAL',
  NOT_ACHIEVED: 'NOT_ACHIEVED',
  UNVERIFIED: 'UNVERIFIED',
};

export function validateOutcomeContract(contract) {
  if (!contract || typeof contract !== 'object') {
    return { valid: false, error: 'Contract must be an object' };
  }
  if (!contract.taskId || typeof contract.taskId !== 'string') {
    return { valid: false, error: 'Contract requires taskId (string)' };
  }
  if (!contract.objective || typeof contract.objective !== 'string') {
    return { valid: false, error: 'Contract requires objective (string)' };
  }
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) {
    return { valid: false, error: 'Contract requires non-empty acceptanceCriteria array' };
  }
  return { valid: true };
}

export function evaluateOutcome(contract, evidenceList = [], observations = []) {
  const validation = validateOutcomeContract(contract);
  if (!validation.valid) {
    return {
      status: OUTCOME_STATUSES.UNVERIFIED,
      error: validation.error,
      criteriaResults: [],
      canComplete: false,
    };
  }

  const criteria = contract.acceptanceCriteria;
  const criteriaResults = [];
  let achievedCount = 0;
  let failedCount = 0;
  let unverifiedCount = 0;

  for (const criterion of criteria) {
    const cId = criterion.id || criterion.description;
    const isMandatory = criterion.mandatory !== false;

    const supportingEvidence = evidenceList.filter(
      (e) => e && (e.criterionId === cId || e.requirementId === cId || e.description?.includes(cId))
    );

    const matchingObs = observations.filter(
      (o) => o && (o.criterionId === cId || o.description?.includes(cId))
    );

    let status = 'UNVERIFIED';
    let detail = 'No supporting evidence or observation found';

    if (supportingEvidence.length > 0) {
      const hasInvalidating = supportingEvidence.some((e) => e && (e.status === 'FAILED' || e.status === 'INVALID' || e.verified === false));
      const hasVerified = supportingEvidence.some((e) => e && (e.status === 'VERIFIED' || e.verified === true || e.status === 'PASSED'));

      if (hasInvalidating) {
        status = 'FAILED';
        detail = 'Evidence indicates failure or invalidation';
      } else if (hasVerified) {
        status = 'SATISFIED';
        detail = 'Supported by verified evidence';
      } else {
        status = 'UNVERIFIED';
        detail = 'Evidence present but unverified';
      }
    } else if (matchingObs.length > 0) {
      status = 'SATISFIED';
      detail = 'Supported by observation';
    }

    if (status === 'SATISFIED') {
      achievedCount++;
    } else if (status === 'FAILED') {
      failedCount++;
    } else {
      unverifiedCount++;
    }

    criteriaResults.push({
      criterionId: cId,
      mandatory: isMandatory,
      status,
      detail,
      evidenceCount: supportingEvidence.length,
      observationCount: matchingObs.length,
    });
  }

  let outcomeStatus = OUTCOME_STATUSES.UNVERIFIED;
  let canComplete = false;

  if (failedCount > 0) {
    outcomeStatus = OUTCOME_STATUSES.NOT_ACHIEVED;
  } else if (achievedCount === criteria.length && failedCount === 0 && unverifiedCount === 0) {
    outcomeStatus = OUTCOME_STATUSES.ACHIEVED;
    canComplete = true;
  } else if (achievedCount > 0 && (unverifiedCount > 0 || failedCount === 0)) {
    outcomeStatus = OUTCOME_STATUSES.PARTIAL;
  } else {
    outcomeStatus = OUTCOME_STATUSES.UNVERIFIED;
  }

  return {
    contract,
    status: outcomeStatus,
    canComplete,
    criteriaResults,
    summary: {
      total: criteria.length,
      achieved: achievedCount,
      failed: failedCount,
      unverified: unverifiedCount,
    },
  };
}
