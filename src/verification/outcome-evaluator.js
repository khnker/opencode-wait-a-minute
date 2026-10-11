/**
 * Outcome Evaluator
 *
 * Verifies that a task's requested outcome satisfies acceptance criteria
 * through traceable, temporally-ordered evidence.
 */

export const OUTCOME_STATUSES = {
  ACHIEVED: 'ACHIEVED',
  PARTIAL: 'PARTIAL',
  NOT_ACHIEVED: 'NOT_ACHIEVED',
  UNVERIFIED: 'UNVERIFIED',
};

export const EVIDENCE_TYPES = {
  EVIDENCE: 'evidence',
  OBSERVATION: 'observation',
  TEST: 'test',
  MEASUREMENT: 'measurement',
  NARRATIVE: 'narrative',
};
export function validateOutcomeContract(contract) {
  if (!contract || typeof contract !== 'object') {
    return { valid: false, error: 'Contract must be an object' };
  }
  if (!contract.taskId || typeof contract.taskId !== 'string' || !contract.taskId.trim()) {
    return { valid: false, error: 'Contract requires non-empty taskId (string)' };
  }
  if (!contract.objective || typeof contract.objective !== 'string' || !contract.objective.trim()) {
    return { valid: false, error: 'Contract requires non-empty objective (string)' };
  }
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) {
    return { valid: false, error: 'Contract requires non-empty acceptanceCriteria array' };
  }
  const ids = new Set();
  for (const c of contract.acceptanceCriteria) {
    if (!c || typeof c !== 'object') {
      return { valid: false, error: 'Each acceptance criterion must be an object' };
    }
    if (!c.id || typeof c.id !== 'string' || !c.id.trim()) {
      return { valid: false, error: 'Each acceptance criterion requires a non-empty string id' };
    }
    if (!c.description || typeof c.description !== 'string' || !c.description.trim()) {
      return { valid: false, error: 'Each acceptance criterion requires a non-empty string description' };
    }
    if (ids.has(c.id)) {
      return { valid: false, error: `Duplicate acceptance criterion id: ${c.id}` };
    }
    ids.add(c.id);
  }
  return { valid: true };
}

/**
 * Determine criterion status from time-ordered evidence and observations.
 *
 * @param {Array} items - Evidence/observations, sorted oldest -> newest
 * @param {Object} criterion - { mandatory, ... }
 * @returns {Object} { status, detail, resolution, finalItem }
 */
function evaluateCriterionItems(items) {
  let satisfied = false;
  let failed = false;
  let unresolved = false;
  let detail = 'No evidence found';
  let finalItem = null;
  let resolution = 'unresolved';

  // Sort by timestamp ascending; fallback to array order.
  const ordered = items
    .filter((i) => i && (i.timestamp || i.createdAt))
    .sort(
      (a, b) =>
        new Date(a.timestamp || a.createdAt || 0).getTime() -
        new Date(b.timestamp || b.createdAt || 0).getTime()
    );

  for (const item of ordered) {
    finalItem = item;
    const status = item.status;
    const type = item.type || item.evidenceType;
    const isValidated = status === 'VERIFIED' || status === 'VALID' || item.verified === true;

    // Explicit invalidation always takes precedence.
    if (status === 'INVALID' || status === 'INVALIDATED' || item.invalidated === true) {
      resolution = 'explicitly_invalidated';
      failed = true;
      satisfied = false;
      detail = `Item invalidated: ${item.description || 'invalid evidence'}`;
      continue;
    }

    // Unverified items never satisfy; they keep the criterion unresolved.
    if (type === EVIDENCE_TYPES.NARRATIVE || (type === EVIDENCE_TYPES.OBSERVATION && !isValidated)) {
      if (!isValidated) {
        resolution = 'unverified';
        detail = 'Evidence/observation is not verified';
      }
      if (!satisfied && !failed) {
        detail = `Unverified ${type} for criterion`;
      }
      continue;
    }

    if (status === 'FAILED' || status === 'INVALID' || item.verified === false) {
      failed = true;
      satisfied = false;
      detail = `Failed evidence (timestamp=${finalItem.timestamp || finalItem.createdAt})`;
      resolution = 'failed';
      continue;
    }

    if (isValidated) {
      // If there was a previous failure, a new verified item only overrides if explicitly superseding or reverifying.
      if (failed && !item.supersedes && !item.reverifies && !item.explicitSupersession) {
        // Keep failed state unless explicit supersession/reverification is provided
        continue;
      }
      satisfied = true;
      failed = false;
      detail = `Verified ${type} (timestamp=${finalItem.timestamp || finalItem.createdAt})`;
      resolution = 'verified';
    }
  }

  if (ordered.length === 0) {
    return { status: 'UNVERIFIED', detail, resolution, finalItem };
  }
  if (satisfied) return { status: 'SATISFIED', detail, resolution, finalItem };
  if (failed) return { status: 'FAILED', detail, resolution, finalItem };
  return { status: 'UNVERIFIED', detail, resolution, finalItem };
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

  // Merge evidence and observations into a single time-ordered item list per criterion.
  const contractId = contract.taskId;
  const itemMap = new Map();
  const getItemsFor = (id) => {
    if (!itemMap.has(id)) itemMap.set(id, []);
    return itemMap.get(id);
  };

  for (const e of evidenceList || []) {
    if (!e) continue;
    const key = e.criterionId || e.requirementId || contractId;
    getItemsFor(key).push({
      ...e,
      kind: e.kind || 'evidence',
      type: e.type || EVIDENCE_TYPES.EVIDENCE,
      timestamp: e.timestamp || e.createdAt || Date.now(),
    });
  }
  for (const o of observations || []) {
    if (!o) continue;
    const key = o.criterionId || o.requirementId || contractId;
    getItemsFor(key).push({
      ...o,
      kind: 'observation',
      type: EVIDENCE_TYPES.OBSERVATION,
      timestamp: o.timestamp || o.createdAt || Date.now(),
    });
  }

  const criteria = contract.acceptanceCriteria || [];
  const criteriaResults = [];
  let mandatoryUnmet = 0;
  let mandatoryFailed = 0;
  let mandatoryVerified = 0;
  let optionalResults = [];

  for (const criterion of criteria) {
    const cId = criterion.id;
    const isMandatory = criterion.mandatory !== false;
    const items = getItemsFor(cId);

    const { status, detail, resolution, finalItem } = evaluateCriterionItems(items);

    const result = {
      criterionId: cId,
      mandatory: isMandatory,
      status,
      detail,
      resolution,
      evidenceCount: items.filter((i) => i.kind === 'evidence' || i.type === EVIDENCE_TYPES.EVIDENCE).length,
      observationCount: items.filter((i) => i.kind === 'observation' || i.type === EVIDENCE_TYPES.OBSERVATION).length,
      lastEvaluation: finalItem?.timestamp || null,
    };

    if (isMandatory) {
      if (status === 'SATISFIED') mandatoryVerified++;
      else if (status === 'FAILED') mandatoryFailed++;
      else mandatoryUnmet++;
    } else {
      optionalResults.push(result);
    }

    criteriaResults.push(result);
  }

  let outcomeStatus = OUTCOME_STATUSES.UNVERIFIED;
  let canComplete = false;

  if (mandatoryFailed > 0) {
    outcomeStatus = OUTCOME_STATUSES.NOT_ACHIEVED;
  } else if (mandatoryVerified > 0 && mandatoryUnmet === 0 && mandatoryFailed === 0) {
    outcomeStatus = OUTCOME_STATUSES.ACHIEVED;
    canComplete = true;
  } else if (mandatoryVerified > 0 && mandatoryUnmet === 0) {
    outcomeStatus = OUTCOME_STATUSES.PARTIAL;
  } else if (mandatoryVerified === 0 && mandatoryUnmet > 0) {
    outcomeStatus = OUTCOME_STATUSES.PARTIAL;
  } else {
    outcomeStatus = OUTCOME_STATUSES.UNVERIFIED;
  }

  return {
    contract,
    status: outcomeStatus,
    canComplete,
    mandatoryCriteria: criteria.filter((c) => c.mandatory !== false).length,
    optionalCriteria: criteria.filter((c) => c.mandatory === false).length,
    criteriaResults,
    optionalCriteriaResults: optionalResults,
    summary: {
      total: criteria.length,
      mandatorySatisfied: mandatoryVerified,
      mandatoryFailed: mandatoryFailed,
      mandatoryUnverified: mandatoryUnmet,
    },
  };
}
