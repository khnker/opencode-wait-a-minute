/**
 * Frontend UX Outcome Evidence Integration
 *
 * Bridges frontend UX acceptance criteria to WAM's existing outcome contract
 * (`src/verification/outcome-evaluator.js`) and evidence lifecycle
 * (`src/evidence/evidence.js`). It is additive: non-UX contracts delegate
 * unchanged to the shared evaluator, so DONE semantics and temporal/verification
 * behavior are untouched.
 *
 * Guarantees (frontend-ux-evidence spec):
 *  - every UX criterion is associated with one or more verification methods
 *    (staticAnalysis, automatedTest, visualInspection, humanEvaluation) and the
 *    association is recorded on the evidence record;
 *  - evidence records carry the completeness fields — baseline behavior,
 *    intended change, observed result, evidence reference, verification status;
 *  - evidence type must be sufficient for the claim type (encoded in
 *    `UX_CLAIM_SUFFICIENT_METHODS`): a passing unit test proves only its covered
 *    behavior, an a11y scanner does not establish full a11y compliance, a
 *    screenshot supports visual claims but not task usability, a code diff does
 *    not prove interaction works, and a usability improvement requires
 *    behavioral (human) evaluation;
 *  - missing or insufficient evidence is never replaced with inferred success:
 *    it is reported as UNVERIFIED, never ACHIEVED;
 *  - contradictions and superseded records are preserved (never dropped).
 */

import {
  OUTCOME_STATUSES,
  validateOutcomeContract,
  evaluateOutcome,
} from '../verification/outcome-evaluator.js';
import {
  EVIDENCE_TYPES,
  EVIDENCE_STRENGTH,
  createEvidence,
  resolveConflict,
} from '../evidence/evidence.js';

/** Verification methods a UX criterion can be associated with. */
export const UX_VERIFICATION_METHODS = Object.freeze({
  STATIC_ANALYSIS: 'staticAnalysis',
  AUTOMATED_TEST: 'automatedTest',
  VISUAL_INSPECTION: 'visualInspection',
  HUMAN_EVALUATION: 'humanEvaluation',
});

const ALL_METHODS = Object.freeze(Object.values(UX_VERIFICATION_METHODS));

/**
 * Evidence the lifecycle may attach to each verification method. Only these
 * types substantiate evidence produced by the method.
 */
export const UX_METHOD_EVIDENCE_TYPES = Object.freeze({
  staticAnalysis: Object.freeze([EVIDENCE_TYPES.TOOL_OUTPUT, EVIDENCE_TYPES.DIRECT]),
  automatedTest: Object.freeze([EVIDENCE_TYPES.TEST_RESULT, EVIDENCE_TYPES.TOOL_OUTPUT]),
  visualInspection: Object.freeze([EVIDENCE_TYPES.DIRECT, EVIDENCE_TYPES.ENVIRONMENT]),
  humanEvaluation: Object.freeze([EVIDENCE_TYPES.USER_CONFIRMATION, EVIDENCE_TYPES.DIRECT]),
});

/** Claim types a UX criterion can make. */
export const UX_CLAIM_TYPES = Object.freeze({
  STATIC: 'static',
  BEHAVIOR: 'behavior',
  VISUAL: 'visual',
  INTERACTION: 'interaction',
  A11Y: 'a11y',
  USABILITY: 'usability',
});

/**
 * Methods that can *sufficiently* substantiate a claim type. This is the
 * executable form of the "verification sufficiency rules" requirement.
 */
export const UX_CLAIM_SUFFICIENT_METHODS = Object.freeze({
  static: Object.freeze([UX_VERIFICATION_METHODS.STATIC_ANALYSIS]),
  behavior: Object.freeze([UX_VERIFICATION_METHODS.AUTOMATED_TEST]),
  visual: Object.freeze([UX_VERIFICATION_METHODS.VISUAL_INSPECTION]),
  interaction: Object.freeze([
    UX_VERIFICATION_METHODS.AUTOMATED_TEST,
    UX_VERIFICATION_METHODS.HUMAN_EVALUATION,
  ]),
  // An a11y scanner alone never establishes compliance.
  a11y: Object.freeze([UX_VERIFICATION_METHODS.HUMAN_EVALUATION]),
  // A usability improvement requires behavioral (human) evaluation.
  usability: Object.freeze([UX_VERIFICATION_METHODS.HUMAN_EVALUATION]),
});

/** Verification status recorded per UX claim. */
export const UX_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
  INVALID: 'invalid',
});

/** Fields every UX evidence record must carry (verification status is derived). */
export const REQUIRED_EVIDENCE_FIELDS = Object.freeze([
  'baseline',
  'intendedChange',
  'observedResult',
  'reference',
]);

function asMethodArray(value) {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter((m) => typeof m === 'string' && ALL_METHODS.includes(m));
}

/** Sufficient verification methods for a claim type, or null when unconstrained. */
export function getSufficientMethods(claimType) {
  if (!claimType) return null;
  const methods = UX_CLAIM_SUFFICIENT_METHODS[claimType];
  return methods ? [...methods] : null;
}

/** True when the contract participates in frontend UX evidence enforcement. */
export function isUxContract(contract) {
  if (!contract || typeof contract !== 'object') return false;
  if (contract.ux === true || contract.domain === 'frontend-ux') return true;
  const criteria = Array.isArray(contract.acceptanceCriteria) ? contract.acceptanceCriteria : [];
  return criteria.some(
    (c) => c && (c.claimType !== undefined || c.verificationMethods !== undefined)
  );
}

/**
 * Associate a UX criterion with its verification method(s). When methods are not
 * declared explicitly they are derived from `evidenceRequirements.types`.
 */
export function associateCriterionMethods(criterion) {
  if (!criterion || typeof criterion !== 'object') {
    return { valid: false, error: 'Criterion must be an object' };
  }
  const methods = asMethodArray(criterion.verificationMethods);
  if (methods.length === 0 && Array.isArray(criterion.evidenceRequirements?.types)) {
    for (const type of criterion.evidenceRequirements.types) {
      for (const [method, types] of Object.entries(UX_METHOD_EVIDENCE_TYPES)) {
        if (types.includes(type) && !methods.includes(method)) methods.push(method);
      }
    }
  }
  if (methods.length === 0) {
    return {
      valid: false,
      criterionId: criterion.id,
      error: `Criterion ${criterion.id}: requires at least one verification method`,
    };
  }
  return {
    valid: true,
    criterionId: criterion.id,
    methods,
    claimType: criterion.claimType || null,
  };
}

/** Normalize a UX contract: derive evidenceRequirements.types from the methods. */
export function buildUxOutcomeContract(contract) {
  const criteria = (contract.acceptanceCriteria || []).map((c) => {
    const methods = asMethodArray(c.verificationMethods);
    const types = new Set(c.evidenceRequirements?.types || []);
    for (const method of methods) {
      for (const type of UX_METHOD_EVIDENCE_TYPES[method] || []) types.add(type);
    }
    const evidenceRequirements = { ...(c.evidenceRequirements || {}) };
    if (types.size > 0) evidenceRequirements.types = [...types];
    return { ...c, evidenceRequirements };
  });
  return { ...contract, acceptanceCriteria: criteria };
}

/**
 * Validate an outcome contract plus the UX-specific requirement that every
 * criterion declares at least one verification method and a known claim type.
 */
export function validateUxEvidenceContract(contract) {
  const base = validateOutcomeContract(contract);
  if (!base.valid) return { valid: false, error: base.error };
  for (const criterion of contract.acceptanceCriteria) {
    const association = associateCriterionMethods(criterion);
    if (!association.valid) return { valid: false, error: association.error };
    if (criterion.claimType !== undefined && !UX_CLAIM_SUFFICIENT_METHODS[criterion.claimType]) {
      return {
        valid: false,
        error: `Acceptance criterion ${criterion.id}: unknown claimType '${criterion.claimType}'`,
      };
    }
  }
  return { valid: true };
}

/** Fields missing from a UX evidence record (empty array = complete). */
export function missingEvidenceFields(record) {
  if (!record || typeof record !== 'object') return [...REQUIRED_EVIDENCE_FIELDS];
  return REQUIRED_EVIDENCE_FIELDS.filter((field) => {
    const value = record[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });
}

/** True when a record carries baseline, intended change, observed result, reference. */
export function isCompleteEvidence(record) {
  return missingEvidenceFields(record).length === 0;
}

function isVerifiedEvidence(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.verificationStatus === UX_VERIFICATION_STATUS.VERIFIED) return true;
  return String(record.status || '').toUpperCase() === 'VERIFIED';
}

/**
 * Create a UX evidence record on top of the shared evidence lifecycle. The
 * association (criterion + verification method) is recorded on the record and
 * the verification status is derived from `verified` — never inferred.
 */
export function createUxEvidence({
  id,
  criterionId,
  verificationMethod = null,
  type,
  source,
  strength = EVIDENCE_STRENGTH.L2_OBSERVATION,
  baseline,
  intendedChange,
  observedResult,
  reference,
  verified = false,
  supports = true,
  supersedes = false,
  reverified = false,
  timestamp,
}) {
  const base = createEvidence({
    id,
    requirementId: criterionId,
    source,
    type,
    observation: observedResult,
    strength,
    supports,
  });
  const missingFields = missingEvidenceFields({ baseline, intendedChange, observedResult, reference });
  return {
    ...base,
    criterionId,
    verificationMethod,
    baseline: baseline ?? null,
    intendedChange: intendedChange ?? null,
    observedResult: observedResult ?? null,
    reference: reference ?? null,
    supports,
    complete: missingFields.length === 0,
    missingFields,
    verificationStatus: verified
      ? UX_VERIFICATION_STATUS.VERIFIED
      : UX_VERIFICATION_STATUS.UNVERIFIED,
    status: verified ? 'VERIFIED' : 'UNVERIFIED',
    verified: verified === true,
    supersedes: supersedes === true,
    reverifies: reverified === true,
    timestamp: timestamp || base.timestamp,
  };
}

/**
 * True when `evidence` can fully substantiate `criterion` according to the
 * sufficiency rules: the method is associated with the criterion, the evidence
 * type is valid for the method, the method is sufficient for the claim type, and
 * the evidence is not a mere claim/inference. Completeness and verification are
 * checked separately by the evaluator gate.
 */
export function isEvidenceSufficient(criterion, evidence) {
  if (!criterion || !evidence) return false;
  const association = associateCriterionMethods(criterion);
  if (!association.valid) return false;
  const method = evidence.verificationMethod;
  if (!method || !association.methods.includes(method)) return false;
  const allowedTypes = UX_METHOD_EVIDENCE_TYPES[method];
  if (!allowedTypes || !allowedTypes.includes(evidence.type)) return false;
  const sufficient = getSufficientMethods(association.claimType);
  if (sufficient && !sufficient.includes(method)) return false;
  // Inference and raw claims never substantiate an executed verification.
  const strength = evidence.strength || evidence.evidenceStrength;
  if (strength === EVIDENCE_STRENGTH.L0_CLAIM || strength === EVIDENCE_STRENGTH.L1_INFERENCE) {
    return false;
  }
  return true;
}

function mapVerificationStatus(status) {
  if (status === 'SATISFIED') return UX_VERIFICATION_STATUS.VERIFIED;
  if (status === 'FAILED') return UX_VERIFICATION_STATUS.INVALID;
  return UX_VERIFICATION_STATUS.UNVERIFIED;
}

function describeMissing(association) {
  const sufficient = getSufficientMethods(association.claimType);
  const methods = sufficient || association.methods;
  return methods.map((method) => `evidence via ${method}`);
}

/**
 * Evaluate a frontend UX outcome.
 *
 * Non-UX contracts are delegated unchanged to `evaluateOutcome`. For UX
 * contracts, only verified, complete, sufficient, non-contradicting evidence is
 * forwarded to the shared evaluator; contradictory evidence is forwarded as an
 * explicit invalidation (fail-closed) so it can still be superseded by a later
 * verified record. Missing/insufficient evidence never satisfies a criterion.
 */
export function evaluateUxOutcome(contract, evidence = [], observations = []) {
  if (!isUxContract(contract)) {
    return { ...evaluateOutcome(contract, evidence, observations), ux: false };
  }

  const validation = validateUxEvidenceContract(contract);
  if (!validation.valid) {
    return {
      ux: true,
      status: OUTCOME_STATUSES.UNVERIFIED,
      achieved: false,
      canComplete: false,
      error: validation.error,
      criteriaResults: [],
      gaps: [],
      contradictions: [],
      evidence: [...evidence],
    };
  }

  const normalized = buildUxOutcomeContract(contract);
  const allEvidence = (evidence || []).filter(Boolean);

  const gatedEvidence = [];
  const criterionMeta = [];
  const gaps = [];
  const contradictions = [];

  for (const criterion of normalized.acceptanceCriteria) {
    const association = associateCriterionMethods(criterion);
    const criterionId = criterion.id;
    const related = allEvidence.filter(
      (e) => e.criterionId === criterionId || e.requirementId === criterionId
    );

    const satisfying = related.filter(
      (e) =>
        e.supports !== false &&
        isVerifiedEvidence(e) &&
        isCompleteEvidence(e) &&
        isEvidenceSufficient(criterion, e)
    );
    const satisfyingIds = new Set(satisfying.map((e) => e.id));
    const contradicting = related.filter((e) => e.supports === false);
    const insufficient = related.filter(
      (e) => e.supports !== false && !satisfyingIds.has(e.id)
    );

    // Preserve contradictions: surface conflicts without dropping records.
    for (const negative of contradicting) {
      for (const positive of satisfying) {
        const conflict = resolveConflict(positive, negative);
        if (conflict) contradictions.push(conflict);
      }
    }

    if (satisfying.length === 0) {
      gaps.push({
        criterionId,
        claimType: association.claimType,
        verificationMethods: association.methods,
        reason:
          contradicting.length > 0
            ? 'CONTRADICTED'
            : insufficient.length > 0
              ? 'INSUFFICIENT_EVIDENCE'
              : 'NO_EVIDENCE',
        missingEvidence: describeMissing(association),
        insufficientEvidenceIds: insufficient.map((e) => e.id),
      });
    }

    // Only the gate decides what reaches the shared evaluator. Contradicting
    // records reach it as invalidations so supersession still works.
    for (const record of satisfying) gatedEvidence.push(record);
    for (const record of contradicting) {
      gatedEvidence.push({ ...record, status: 'INVALID', verified: false });
    }

    criterionMeta.push({ criterion, association });
  }

  const result = evaluateOutcome(normalized, gatedEvidence, observations);
  const criteriaResults = (result.criteriaResults || []).map((entry) => {
    const meta = criterionMeta.find((m) => m.criterion.id === entry.criterionId);
    return {
      ...entry,
      verificationMethods: meta ? meta.association.methods : [],
      claimType: meta ? meta.association.claimType : null,
      verificationStatus: mapVerificationStatus(entry.status),
    };
  });

  return {
    ...result,
    ux: true,
    achieved: result.status === OUTCOME_STATUSES.ACHIEVED,
    criteriaResults,
    gaps,
    contradictions,
    evidence: allEvidence,
  };
}
