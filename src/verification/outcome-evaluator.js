/**
 * Outcome Evaluator
 *
 * Implements outcome-based completion: verifying that the requested outcome
 * satisfies acceptance criteria with sufficient traceable evidence, rather than
 * relying solely on task execution or tests finishing.
 *
 * Outcome Statuses:
 *   - ACHIEVED: all mandatory criteria satisfied by sufficient evidence.
 *   - PARTIAL: some criteria satisfied, but at least one mandatory criterion unmet.
 *   - NOT_ACHIEVED: evidence demonstrates the objective was not achieved.
 *   - UNVERIFIED: evidence is insufficient to determine outcome.
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

/**
 * Evaluate outcome against contract, evidence, and observations.
 *
 * @param {Object} contract - Outcome contract { taskId, objective, acceptanceCriteria, ... }
 * @param {Array} evidenceList - Array of evidence items linked to the task
 * @param {Array} observations - Array of observed facts/measurements
 * @returns {Object} Outcome evaluation record
 */
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
  let unmetCount = 0;
  let unverifiedCount = 0;

  for (const criterion of criteria) {
    const cId = criterion.id || criterion.description;
    const isMandatory = criterion.mandatory !== false;

    // Find supporting evidence for this criterion
    const supportingEvidence = evidenceList.filter(
      (e) => e && (e.criterionId === cId || e.requirementId === cId || e.description?.includes(cId))
    );

    // Find matching observations
    const matchingObs = observations.filter(
      (o) => o && (o.criterionId === cId || o.description?.includes(cId))
    );

    let status = 'UNVERIFIED';
    let detail = 'No supporting evidence or observation found';

    if (supportingEvidence.length > 0) {
      const hasInvalidating = supportingEvidence.some((e) => e.status === 'INVALID' || e.status === 'FAILED');
      const hasVerified = supportingEvidence.some((e) => e.status === 'VERIFIED' || e.verified === true || e.status === 'PASSED');

      if (hasInvalidating) {
        status = 'FAILED';
        detail = 'Evidence indicates failure or invalidation';
      } else if (hasVerified || supportingEvidence.length > 0) {
        status = 'SATISFIED';
        detail = 'Supported by evidence';
      }
    } else if (matchingObs.length > 0) {
      status = 'SATISFIED';
      detail = 'Supported by observation';
    }

    if (status === 'SATISFIED') {
      achievedCount++;
    } else if (status === 'FAILED') {
      unmetCount++;
    } else {
      unverifiedCount++;
      if (isMandatory) unmetCount++;
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

  if (unmetCount > 0 && achievedCount === 0) {
    outcomeStatus = OUTCOME_STATUSES.NOT_ACHIEVED;
  } else if (unmetCount > 0 || unverifiedCount > 0) {
    outcomeStatus = OUTCOME_STATUSES.PARTIAL;
  } else if (achievedCount === criteria.length && unmetCount === 0) {
    outcomeStatus = OUTCOME_STATUSES.ACHIEVED;
    canComplete = true;
  } else {
    outcomeStatus = OUTCOME_STATUSES.PARTIAL;
  }

  return {
    contract,
    status: outcomeStatus,
    canComplete,
    criteriaResults,
    summary: {
      total: criteria.length,
      achieved: achievedCount,
      unmet: unmetCount,
      unverified: unverifiedCount,
    },
  };
}
