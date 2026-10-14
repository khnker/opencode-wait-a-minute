/**
 * Frontend UX benchmark rubric (independent scoring dimensions).
 *
 * Each dimension is a capability checklist (not artifact proxies). The rubric is
 * fixed across all benchmark runs, ensuring the same evaluator can compare across
 * conditions A/B/C and across corpus case types (greenfield, improvement, bug fix, a11y improvement, refinement).
 *
 * Dimensions follow the specification from:
 *   - openspec/changes/benchmark-impeccable-frontend-outcomes/specs/frontend-ux-benchmark/spec.md
 *
 * The `Rubric` object is a pure, total function: no I/O, no network, no throws.
 * It yields a shape that can be used by the harness to request evidence and verify
 * coverage.
 */

export const DIMENSION_METADATA = Object.freeze({
  usability: {
    tierLabel: "Capability",
    description: "The artifact can be used to accomplish its intended task without requiring workarounds, excessive cognitive load, or novel steps.",
    evidenceRequirements: ["outcome", "quality", "userConfirmation"],
  },
  visualHierarchy: {
    tierLabel: "Clarity",
    description: "The artifact presents a clear, logical, and accessible visual organization that guides the user to primary actions and important information.",
    evidenceRequirements: ["structure", "layout", "pattern"],
  },
  accessibility: {
    tierLabel: "Compliance",
    description: "The artifact meets the WAM accessibility definitions for screen readers, focus management, and assistive technology.",
    evidenceRequirements: ["assessment", "validation", "measure"],
  },
  interactionBehavior: {
    tierLabel: "Responsiveness",
    description: "The artifact provides immediate, predictable, and understandable feedback for user interactions and adapts to user input patterns.",
    evidenceRequirements: ["outcome", "behavior", "validation"],
  },
  responsiveBehavior: {
    tierLabel: "Adaptability",
    description: "The artifact adapts to viewport and device constraints without loss of functionality or meaning.",
    evidenceRequirements: ["layout", "structure", "measure"],
  },
  regressionRisk: {
    tierLabel: "Safety",
    description: "The artifact does not introduce new defects or regressions relative to a known good baseline.",
    evidenceRequirements: ["comparative", "contract", "measurement"],
  },
});

export const DIMENSION_IDS = Object.freeze(Object.keys(DIMENSION_METADATA));

export const TIER_BY_DIMENSION = Object.freeze({
  usability: 3,
  visualHierarchy: 3,
  accessibility: 3,
  interactionBehavior: 3,
  responsiveBehavior: 3,
  regressionRisk: 2,
});

/** Fixed rubric for the benchmark. */
export const BENCHMARK_RUBRIC = Object.freeze({
  dimensions: Object.fromEntries(DIMENSION_IDS.map((dim) => [dim, DIMENSION_METADATA[dim]])),
  tiers: {
    "1": { label: "Basic", difficulty: "minimal effort, common patterns", coverage: "basic capability", maxPoints: 1 },
    "2": { label: "Standard", difficulty: "common patterns with constraints", coverage: "standard capability", maxPoints: 3 },
    "3": { label: "Advanced", difficulty: "exotic edge cases, best practice enforcement", coverage: "advanced capability", maxPoints: 5 },
  },
});

/**
 * Builds a scoring rubric definition for a single case from the corpus.
 *
 * Returns an object with `dimensions` and `criteria` (criterion checklist). The
 * caller controls which criteria are required/mandatory for each condition.
 *
 * The rubric is an input to the benchmark harness, not the scoring engine — it
 * simply describes what constitutes evidence for each dimension.
 */
export function buildRubric(caseDefinition, weights) {
  const { criteria } = caseDefinition;
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return { dimensions: {}, criteria: [] };
  }

  const rubric = {
    dimensions: Object.fromEntries(DIMENSION_IDS.map((dim) => [dim, { ...BENCHMARK_RUBRIC.dimensions[dim] }])),
    criteria: criteria.map(({ id, dimension, mandatory, tier, description, addresses, flaky }) => Object.freeze({
      id,
      dimension,
      mandatory,
      tier,
      description,
      addresses,
      flaky,
    })),
  };

  return Object.freeze(rubric);
}

/**
 * Validates a rubric shape. Pure; returns `{ ok, errors }`.
 */
export function validateRubric(rubric) {
  const errors = [];
  if (!rubric || typeof rubric !== "object") {
    errors.push("rubric must be an object");
    return { ok: false, errors };
  }
  const dims = rubric.dimensions || {};
  for (const dim of DIMENSION_IDS) {
    if (!dims[dim]) errors.push(`missing dimension '${dim}'`);
    else if (typeof dims[dim] !== "object") errors.push(`dimension '${dim}' must be an object`);
  }
  if (!Array.isArray(rubric.criteria)) errors.push("criteria must be an array");
  else {
    const critIds = new Set();
    for (const c of rubric.criteria) {
      if (!c.id) { errors.push("criterion missing id"); continue; }
      if (critIds.has(c.id)) errors.push(`duplicate criterion id '${c.id}'`);
      critIds.add(c.id);
      if (!DIMENSION_IDS.includes(c.dimension)) errors.push(`criterion '${c.id}' dimension is unknown`);
      if (typeof c.mandatory !== "boolean") errors.push(`criterion '${c.id}' must have mandatory boolean`);
      if (![1, 2, 3].includes(c.tier)) errors.push(`criterion '${c.id}' tier must be 1, 2, or 3`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Parses a JSON value for a benchmark harness execution.
 * If parsing fails, returns a sanitized (empty) rubric.
 */
export function safeParseRubric(json) {
  try {
    return JSON.parse(json);
  } catch (e) {
    return { dimensions: {}, criteria: [] };
  }
}

/**
 * Normalizes a `knownDefect` from the corpus to a rubric-facing shape.
 */
export function normalizeDefect(defect) {
  return defect && typeof defect === "object"
    ? Object.freeze({ id: defect.id, description: defect.description })
    : null;
}

/**
 * Normalizes a `criterion` from the corpus to the benchmark rubric.
 */
export function normalizeCriterion(crit) {
  if (!crit || typeof crit !== "object") return null;
  const { id, dimension, mandatory, tier, description, addresses, flaky } = crit;
  return Object.freeze({
    id,
    dimension,
    mandatory,
    tier,
    description,
    addresses,
    flaky,
  });
}

/**
 * Maps corpus case metadata to rubric edges for evidence association.
 */
export function buildCriterionToDefectMap(caseDef) {
  const map = new Map();
  const crits = caseDef.criteria || [];
  const defects = caseDef.knownDefects || [];
  for (const crit of crits) {
    const matches = defects.filter((d) => crit.addresses === d.id);
    if (matches.length > 0) map.set(crit.id, matches.map((d) => d.id));
  }
  return map;
}