/**
 * Task-specific quality contracts.
 *
 * Resolves per-criterion evidence requirements from an explicit criterion
 * declaration or from a task-kind default profile, then evaluates whether the
 * recorded evidence is sufficient, fresh and non-contradictory.
 */
import {
  TASK_EVIDENCE_STRENGTH,
  TASK_EVIDENCE_TYPES,
} from "../verification/outcome-evaluator.js";

export const TASK_KINDS = Object.freeze({
  RESEARCH: "research",
  IMPLEMENTATION: "implementation",
  DEBUGGING: "debugging",
  REFACTORING: "refactoring",
  REVIEW: "review",
  DOCUMENTATION: "documentation",
  UNKNOWN: "unknown",
});

const KIND_ALIASES = new Map([
  ["research", "research"],
  ["investigation", "research"],
  ["investigate", "research"],
  ["creation", "implementation"],
  ["create", "implementation"],
  ["feature", "implementation"],
  ["implement", "implementation"],
  ["implementation", "implementation"],
  ["modification", "implementation"],
  ["modify", "implementation"],
  ["bugfix", "debugging"],
  ["fix", "debugging"],
  ["bug", "debugging"],
  ["debug", "debugging"],
  ["debugging", "debugging"],
  ["refactor", "refactoring"],
  ["review", "review"],
  ["audit", "review"],
  ["docs", "documentation"],
  ["doc", "documentation"],
  ["documentation", "documentation"],
]);

const STRENGTH_RANK = Object.freeze({
  L0_CLAIM: 0,
  L1_INFERENCE: 1,
  L2_OBSERVATION: 2,
  L3_DIRECT: 3,
  L4_VERIFICATION: 4,
});

const OBSERVATION_TYPES = [
  TASK_EVIDENCE_TYPES.DIRECT,
  TASK_EVIDENCE_TYPES.DERIVED,
  TASK_EVIDENCE_TYPES.TOOL_OUTPUT,
];

const KIND_PROFILES = Object.freeze({
  research: Object.freeze([
    { types: OBSERVATION_TYPES, minStrength: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION, minCount: 1 },
  ]),
  implementation: Object.freeze([
    { types: [TASK_EVIDENCE_TYPES.TEST_RESULT], minStrength: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION, minCount: 1 },
    { types: [TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_TYPES.DERIVED], minStrength: TASK_EVIDENCE_STRENGTH.L3_DIRECT, minCount: 1 },
  ]),
  debugging: Object.freeze([
    { types: [TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_TYPES.NEGATIVE, TASK_EVIDENCE_TYPES.TOOL_OUTPUT], minStrength: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION, minCount: 1 },
    { types: [TASK_EVIDENCE_TYPES.TEST_RESULT], minStrength: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION, minCount: 1 },
  ]),
  refactoring: Object.freeze([
    { types: [TASK_EVIDENCE_TYPES.TEST_RESULT], minStrength: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION, minCount: 1 },
    { types: [TASK_EVIDENCE_TYPES.DERIVED, TASK_EVIDENCE_TYPES.DIRECT], minStrength: TASK_EVIDENCE_STRENGTH.L3_DIRECT, minCount: 1 },
  ]),
  review: Object.freeze([
    { types: OBSERVATION_TYPES, minStrength: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION, minCount: 1 },
  ]),
  documentation: Object.freeze([
    { types: [TASK_EVIDENCE_TYPES.DIRECT, TASK_EVIDENCE_TYPES.DERIVED], minStrength: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION, minCount: 1 },
  ]),
  unknown: Object.freeze([]),
});

const TYPE_INFERENCE = Object.freeze({
  [TASK_EVIDENCE_TYPES.TEST_RESULT]: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION,
  [TASK_EVIDENCE_TYPES.USER_CONFIRMATION]: TASK_EVIDENCE_STRENGTH.L4_VERIFICATION,
  [TASK_EVIDENCE_TYPES.DIRECT]: TASK_EVIDENCE_STRENGTH.L3_DIRECT,
  [TASK_EVIDENCE_TYPES.TOOL_OUTPUT]: TASK_EVIDENCE_STRENGTH.L3_DIRECT,
  [TASK_EVIDENCE_TYPES.DERIVED]: TASK_EVIDENCE_STRENGTH.L1_INFERENCE,
  [TASK_EVIDENCE_TYPES.INFERRED]: TASK_EVIDENCE_STRENGTH.L1_INFERENCE,
  [TASK_EVIDENCE_TYPES.NEGATIVE]: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION,
  [TASK_EVIDENCE_TYPES.ENVIRONMENT]: TASK_EVIDENCE_STRENGTH.L2_OBSERVATION,
});

const FAILED_STATUSES = new Set(["fail", "failed", "FAIL", "FAILED", "false"]);
const PASSED_STATUSES = new Set(["pass", "passed", "PASS", "PASSED", "true", "verified"]);

export function normalizeTaskKind(kind) {
  if (typeof kind !== "string") return TASK_KINDS.UNKNOWN;
  return KIND_ALIASES.get(kind.trim().toLowerCase()) || TASK_KINDS.UNKNOWN;
}

export function inferTaskKind(task = {}) {
  const declared = task.kind || task.taskKind || task.task_type || task.outcomeContract?.kind;
  const normalized = normalizeTaskKind(declared);
  if (normalized !== TASK_KINDS.UNKNOWN) return normalized;

  const text = [
    task.objective,
    task.title,
    ...(Array.isArray(task.requirements) ? task.requirements.map((r) => `${r.id || ""} ${r.title || ""} ${r.description || ""}`) : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text) return TASK_KINDS.UNKNOWN;
  if (/\brefactor/.test(text)) return TASK_KINDS.REFACTORING;
  if (/\b(debug|bug|bugfix|fix|failure|error|errores|regression|falla|fallas|corrige|corregir|correcci[oó]n|arregla|arreglar|arreglo)\b/.test(text)) return TASK_KINDS.DEBUGGING;
  if (/\b(review|audit|inspect)\b/.test(text)) return TASK_KINDS.REVIEW;
  if (/\b(document|documentation|readme|docs)\b/.test(text)) return TASK_KINDS.DOCUMENTATION;
  if (/\b(research|investigate|explore|compare|evaluate|analysis)\b/.test(text)) return TASK_KINDS.RESEARCH;
  if (/\b(implement|create|add|build|modify|change|migrate)\b/.test(text)) return TASK_KINDS.IMPLEMENTATION;
  return TASK_KINDS.UNKNOWN;
}

function criteriaOf(task = {}) {
  const contractCriteria = task.outcomeContract?.acceptanceCriteria;
  if (Array.isArray(contractCriteria) && contractCriteria.length > 0) return contractCriteria;
  if (Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length > 0) return task.acceptanceCriteria;
  return Array.isArray(task.requirements) ? task.requirements : [];
}

function normalizeRequirement(requirement = {}) {
  const rawTypes = Array.isArray(requirement.types)
    ? requirement.types
    : requirement.type
      ? [requirement.type]
      : [];
  const types = rawTypes.filter((type) => Object.values(TASK_EVIDENCE_TYPES).includes(type));
  const minStrength = Object.values(TASK_EVIDENCE_STRENGTH).includes(requirement.minStrength)
    ? requirement.minStrength
    : TASK_EVIDENCE_STRENGTH.L2_OBSERVATION;
  const minCount = Number.isInteger(requirement.minCount) && requirement.minCount > 0
    ? requirement.minCount
    : 1;
  return { types: types.length > 0 ? types : OBSERVATION_TYPES, minStrength, minCount };
}

function declaredRequirements(criterion = {}) {
  const declared = criterion.evidenceRequirements;
  if (!declared) return null;
  if (Array.isArray(declared)) {
    return declared.length > 0 ? declared.map(normalizeRequirement) : null;
  }
  if (typeof declared === "object") return [normalizeRequirement(declared)];
  return null;
}

export function resolveQualityContract(task = {}) {
  const kind = inferTaskKind(task);
  const profile = KIND_PROFILES[kind] || [];
  const maxAgeMs = Number.isFinite(task.quality?.maxAgeMs) && task.quality.maxAgeMs > 0
    ? task.quality.maxAgeMs
    : null;

  const criteria = criteriaOf(task).map((criterion) => {
    const id = criterion.id || criterion.criterionId || criterion.requirementId || null;
    const explicit = declaredRequirements(criterion);
    const source = explicit ? "criterion" : profile.length > 0 ? "kind" : "none";
    return {
      criterionId: id,
      mandatory: criterion.mandatory !== false,
      source,
      requirements: explicit || profile.map((requirement) => ({ ...requirement })),
    };
  });

  return { taskId: task.id || task.taskId || null, kind, criteria, maxAgeMs };
}

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const type = Object.values(TASK_EVIDENCE_TYPES).includes(item.type)
        ? item.type
        : null;
      const strength = Object.values(TASK_EVIDENCE_STRENGTH).includes(item.strength)
        ? item.strength
        : TYPE_INFERENCE[type] || TASK_EVIDENCE_STRENGTH.L0_CLAIM;
      const rawStatus = item.status ?? item.outcome;
      const failed = item.ok === false || (typeof rawStatus === "string" && FAILED_STATUSES.has(rawStatus));
      const passed = item.ok === true || (typeof rawStatus === "string" && PASSED_STATUSES.has(rawStatus));
      return {
        id: item.id || item.evidenceId || `ev-${index}`,
        criterionId: item.criterionId || item.requirementId || null,
        type,
        strength,
        status: failed ? "fail" : passed ? "pass" : "observed",
        sourceRef: item.sourceRef || item.source || null,
        hash: item.hash || null,
        supersedes: Array.isArray(item.supersedes) ? item.supersedes : [],
        timestamp: item.timestamp || item.createdAt || null,
      };
    });
}

export function collectTaskEvidence(task = {}) {
  if (Array.isArray(task.evidence)) return task.evidence;
  if (Array.isArray(task.verification?.evidence)) return task.verification.evidence;
  if (Array.isArray(task.outcomeContract?.evidence)) return task.outcomeContract.evidence;
  const requirements = Array.isArray(task.requirements) ? task.requirements : [];
  const collected = [];
  for (const requirement of requirements) {
    const items = Array.isArray(requirement.evidence) ? requirement.evidence : [];
    for (const item of items) {
      collected.push(
        typeof item === "object" && item !== null
          ? { ...item, criterionId: item.criterionId || requirement.id }
          : { criterionId: requirement.id, type: TASK_EVIDENCE_TYPES.DIRECT },
      );
    }
  }
  return collected;
}

export function detectStaleEvidence(evidence = [], options = {}) {
  const { now = null, hashes = null, maxAgeMs = null } = options;
  const items = normalizeEvidence(evidence);
  const stale = [];
  for (const item of items) {
    if (item.sourceRef && item.hash && hashes && hashes[item.sourceRef] != null && hashes[item.sourceRef] !== item.hash) {
      stale.push({ evidenceId: item.id, criterionId: item.criterionId, sourceRef: item.sourceRef, reason: "hash-mismatch" });
      continue;
    }
    if (maxAgeMs && Number.isFinite(now) && item.timestamp) {
      const at = Date.parse(item.timestamp);
      if (Number.isFinite(at) && now - at > maxAgeMs) {
        stale.push({ evidenceId: item.id, criterionId: item.criterionId, sourceRef: item.sourceRef, reason: "expired" });
      }
    }
  }
  return stale;
}

export function detectContradictions(contract = {}, evidence = []) {
  const items = normalizeEvidence(evidence);
  const mandatory = new Set(
    (contract.criteria || []).filter((c) => c.mandatory && c.criterionId).map((c) => c.criterionId),
  );
  const contradictions = [];

  const failed = items.filter((item) => item.status === "fail" && mandatory.has(item.criterionId));
  if (failed.length > 0) {
    contradictions.push({
      criterionId: failed[0].criterionId,
      evidenceIds: failed.map((item) => item.id),
      reason: "failed-evidence",
    });
  }

  const bySource = new Map();
  for (const item of items) {
    if (!item.sourceRef || !item.hash) continue;
    if (!bySource.has(item.sourceRef)) bySource.set(item.sourceRef, []);
    bySource.get(item.sourceRef).push(item);
  }
  for (const [sourceRef, group] of bySource) {
    const hashes = new Set(group.map((item) => item.hash));
    if (hashes.size < 2) continue;
    const superseded = new Set(group.flatMap((item) => item.supersedes));
    const unresolved = group.filter((item) => !superseded.has(item.id));
    if (unresolved.length > 1) {
      contradictions.push({
        criterionId: unresolved[0].criterionId,
        sourceRef,
        evidenceIds: unresolved.map((item) => item.id),
        reason: "conflicting-hashes",
      });
    }
  }

  return contradictions;
}

function meets(item, requirement) {
  return (
    item.type !== null &&
    requirement.types.includes(item.type) &&
    STRENGTH_RANK[item.strength] >= STRENGTH_RANK[requirement.minStrength]
  );
}

export function evaluateEvidenceSufficiency(contract = {}, evidence = [], options = {}) {
  if (!Array.isArray(contract.criteria)) {
    throw new TypeError("quality-contract: resolved contract with criteria required");
  }
  const items = normalizeEvidence(evidence);
  const stale = detectStaleEvidence(items, {
    now: options.now,
    hashes: options.hashes,
    maxAgeMs: options.maxAgeMs ?? contract.maxAgeMs ?? null,
  });
  const contradictions = detectContradictions(contract, items);

  const staleIds = new Set(stale.map((entry) => entry.evidenceId));
  const mandatory = contract.criteria.filter((criterion) => criterion.mandatory);
  const missing = [];
  let satisfied = 0;

  for (const criterion of mandatory) {
    const relevant = items.filter(
      (item) => item.criterionId === criterion.criterionId && !staleIds.has(item.id),
    );
    let criterionSatisfied = true;
    for (const requirement of criterion.requirements || []) {
      const matching = relevant.filter((item) => meets(item, requirement));
      if (matching.length < requirement.minCount) {
        criterionSatisfied = false;
        const sameType = relevant.filter((item) => requirement.types.includes(item.type));
        missing.push({
          criterionId: criterion.criterionId,
          types: requirement.types,
          minStrength: requirement.minStrength,
          requiredCount: requirement.minCount,
          actualCount: matching.length,
          reason: sameType.length > 0 ? "insufficient-strength-or-count" : "missing-evidence",
        });
      }
    }
    if (criterionSatisfied) satisfied++;
  }

  const relevantStale = stale.filter(
    (entry) => entry.criterionId && mandatory.some((criterion) => criterion.criterionId === entry.criterionId),
  );
  const blockingContradictions = contradictions.filter(
    (entry) => !entry.criterionId || mandatory.some((criterion) => criterion.criterionId === entry.criterionId),
  );

  const reasons = [
    ...missing.map((entry) => `missing:${entry.criterionId}:${entry.reason}:${entry.types.join("|")}`),
    ...relevantStale.map((entry) => `stale:${entry.criterionId}:${entry.reason}`),
    ...blockingContradictions.map((entry) => `contradiction:${entry.criterionId}:${entry.reason}`),
  ];

  return {
    kind: contract.kind || TASK_KINDS.UNKNOWN,
    sufficient: reasons.length === 0,
    score: mandatory.length === 0 ? 1 : satisfied / mandatory.length,
    missing,
    stale: relevantStale,
    contradictions: blockingContradictions,
    reasons,
  };
}

export function evaluateTaskQuality(task = {}, evidence = collectTaskEvidence(task), options = {}) {
  const contract = resolveQualityContract(task);
  return {
    contract,
    evaluation: evaluateEvidenceSufficiency(contract, evidence, {
      ...options,
      maxAgeMs: options.maxAgeMs ?? contract.maxAgeMs,
    }),
  };
}
