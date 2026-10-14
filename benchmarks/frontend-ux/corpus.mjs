/**
 * Frontend UX benchmark corpus.
 *
 * Five frontend UX task cases (per the `frontend-ux-benchmark` spec). Each case
 * carries the fields the spec requires: baseline repo, task spec, expected
 * outcomes, known defects, and the independent scoring rubric selection.
 *
 * The corpus is static data — no I/O, no network, fully deterministic.
 *
 * Scoring is expressed as a fixed capability checklist (`criteria`). Each
 * criterion belongs to one rubric dimension and is tiered 1..3 by execution
 * difficulty. A condition "covers" a criterion only when it can supply
 * independent evidence for it, so coverage reflects capability — never artifact
 * length, findings count, or code volume.
 */

export const CORPUS_VERSION = "1.0.0";

/** Canonical rubric dimension ids (definitions live in rubric.mjs). */
export const RUBRIC_DIMENSION_IDS = Object.freeze([
  "usability",
  "visualHierarchy",
  "accessibility",
  "interactionBehavior",
  "responsiveBehavior",
  "regressionRisk",
]);

const CASE_ENTRIES = [
  {
    id: "case-1-new-screen",
    title: "New screen from requirement",
    type: "greenfield",
    baselineRepo: {
      snapshotId: "snap-frontend-ux-01",
      commit: "a1c0ffee01",
      fixturePath: "benchmarks/frontend-ux/fixtures/repos/case-1-new-screen",
    },
    taskSpec:
      "Implement a 'Usage' screen from the provided requirement: heading, data table, empty state, and loading state.",
    expectedOutcomes: [
      { id: "eo-1-1", description: "Screen renders with a heading and the data table", mandatory: true },
      { id: "eo-1-2", description: "Empty state is shown when there is no data", mandatory: true },
      { id: "eo-1-3", description: "Loading state is shown while data loads", mandatory: false },
    ],
    knownDefects: [],
    rubric: {
      weights: { usability: 0.3, visualHierarchy: 0.3, accessibility: 0.2, interactionBehavior: 0.2 },
    },
    criteria: [
      { id: "c1-usability-task-complete", dimension: "usability", mandatory: true, tier: 1, description: "Primary task can be completed without a dead end" },
      { id: "c1-usability-empty-state", dimension: "usability", mandatory: false, tier: 2, description: "Empty state guides the next action" },
      { id: "c1-hierarchy-primary-action", dimension: "visualHierarchy", mandatory: true, tier: 2, description: "Exactly one clear primary action per region" },
      { id: "c1-hierarchy-spacing-scale", dimension: "visualHierarchy", mandatory: false, tier: 3, flaky: true, description: "Spacing follows a consistent scale" },
      { id: "c1-a11y-labels", dimension: "accessibility", mandatory: true, tier: 3, description: "Interactive controls expose accessible names" },
      { id: "c1-interaction-feedback", dimension: "interactionBehavior", mandatory: true, tier: 1, description: "Actions produce visible feedback" },
    ],
  },
  {
    id: "case-2-form-improvement",
    title: "Improve form with known interaction/validation defects",
    type: "improvement",
    baselineRepo: {
      snapshotId: "snap-frontend-ux-02",
      commit: "a1c0ffee02",
      fixturePath: "benchmarks/frontend-ux/fixtures/repos/case-2-form-improvement",
    },
    taskSpec:
      "Improve the checkout form: fix double-submit and surface inline validation for an invalid email.",
    expectedOutcomes: [
      { id: "eo-2-1", description: "Submitting twice does not create two requests", mandatory: true },
      { id: "eo-2-2", description: "Invalid email shows an inline error", mandatory: true },
      { id: "eo-2-3", description: "Submit payload contract is unchanged", mandatory: true },
    ],
    knownDefects: [
      { id: "defect-interaction-a", description: "Submit button re-enables before the request settles" },
      { id: "defect-validation-b", description: "Invalid email is not surfaced to the user" },
    ],
    rubric: {
      weights: { interactionBehavior: 0.5, visualHierarchy: 0.2, regressionRisk: 0.3 },
    },
    criteria: [
      { id: "c2-interaction-single-submit", dimension: "interactionBehavior", mandatory: true, tier: 2, addresses: "defect-interaction-a", description: "Single in-flight submit is guarded" },
      { id: "c2-interaction-disabled-state", dimension: "interactionBehavior", mandatory: false, tier: 1, description: "Submit is disabled while pending" },
      { id: "c2-validation-inline-errors", dimension: "interactionBehavior", mandatory: true, tier: 2, addresses: "defect-validation-b", description: "Invalid email is rendered inline" },
      { id: "c2-hierarchy-field-grouping", dimension: "visualHierarchy", mandatory: false, tier: 3, description: "Related fields are grouped consistently" },
      { id: "c2-regression-contract", dimension: "regressionRisk", mandatory: true, tier: 1, description: "Submit payload contract is unchanged" },
    ],
  },
  {
    id: "case-3-responsive-fix",
    title: "Fix responsive layout with reproducible viewport failures",
    type: "bug fix",
    baselineRepo: {
      snapshotId: "snap-frontend-ux-03",
      commit: "a1c0ffee03",
      fixturePath: "benchmarks/frontend-ux/fixtures/repos/case-3-responsive-fix",
    },
    taskSpec: "Fix responsive layout failures at 320px, 768px and 1440px viewports.",
    expectedOutcomes: [
      { id: "eo-3-1", description: "No horizontal scroll at 320px", mandatory: true },
      { id: "eo-3-2", description: "Content remains readable at 768px", mandatory: true },
      { id: "eo-3-3", description: "Layout remains intact at 1440px", mandatory: true },
    ],
    knownDefects: [
      { id: "defect-viewport-320", description: "Overflow at 320px viewport" },
      { id: "defect-viewport-768", description: "Broken grid at 768px viewport" },
      { id: "defect-viewport-1440", description: "Clipping at 1440px viewport" },
    ],
    rubric: {
      weights: { responsiveBehavior: 0.5, visualHierarchy: 0.2, regressionRisk: 0.3 },
    },
    criteria: [
      { id: "c3-responsive-320", dimension: "responsiveBehavior", mandatory: true, tier: 2, addresses: "defect-viewport-320", description: "Layout holds at 320px" },
      { id: "c3-responsive-768", dimension: "responsiveBehavior", mandatory: true, tier: 2, addresses: "defect-viewport-768", description: "Layout holds at 768px" },
      { id: "c3-responsive-1440", dimension: "responsiveBehavior", mandatory: true, tier: 3, addresses: "defect-viewport-1440", description: "Layout holds at 1440px" },
      { id: "c3-visual-overflow", dimension: "visualHierarchy", mandatory: false, tier: 3, description: "No clipping or overflow" },
      { id: "c3-regression-desktop", dimension: "regressionRisk", mandatory: true, tier: 1, description: "Desktop baseline layout is preserved" },
    ],
  },
  {
    id: "case-4-a11y-keyboard",
    title: "Improve keyboard nav + accessible states",
    type: "a11y improvement",
    baselineRepo: {
      snapshotId: "snap-frontend-ux-04",
      commit: "a1c0ffee04",
      fixturePath: "benchmarks/frontend-ux/fixtures/repos/case-4-a11y-keyboard",
    },
    taskSpec: "Make the toolbar keyboard navigable with visible focus and announced state changes.",
    expectedOutcomes: [
      { id: "eo-4-1", description: "Focus is always visible", mandatory: true },
      { id: "eo-4-2", description: "Tab order is logical", mandatory: true },
      { id: "eo-4-3", description: "State changes are announced", mandatory: true },
    ],
    knownDefects: [
      { id: "missing-focus-styles", description: "No visible focus styles" },
      { id: "broken-tab-order", description: "Tab order does not follow visual order" },
    ],
    rubric: {
      weights: { accessibility: 0.5, interactionBehavior: 0.3, regressionRisk: 0.2 },
    },
    criteria: [
      { id: "c4-a11y-focus-visible", dimension: "accessibility", mandatory: true, tier: 2, addresses: "missing-focus-styles", description: "Visible focus indicator on all controls" },
      { id: "c4-a11y-tab-order", dimension: "accessibility", mandatory: true, tier: 2, addresses: "broken-tab-order", description: "Tab order follows visual order" },
      { id: "c4-a11y-state-announced", dimension: "accessibility", mandatory: true, tier: 3, description: "State changes are announced" },
      { id: "c4-interaction-keyboard-operable", dimension: "interactionBehavior", mandatory: true, tier: 1, description: "All actions are keyboard operable" },
      { id: "c4-regression-pointer", dimension: "regressionRisk", mandatory: false, tier: 1, flaky: true, description: "Pointer interactions are preserved" },
    ],
  },
  {
    id: "case-5-visual-refine",
    title: "Refine visually inconsistent component without changing functional contract",
    type: "refinement",
    baselineRepo: {
      snapshotId: "snap-frontend-ux-05",
      commit: "a1c0ffee05",
      fixturePath: "benchmarks/frontend-ux/fixtures/repos/case-5-visual-refine",
    },
    taskSpec: "Refine the card component for visual consistency without changing its functional contract.",
    expectedOutcomes: [
      { id: "eo-5-1", description: "Spacing is consistent", mandatory: true },
      { id: "eo-5-2", description: "Font weights are consistent", mandatory: true },
      { id: "eo-5-3", description: "Functional contract is unchanged", mandatory: true },
    ],
    knownDefects: [
      { id: "inconsistent-spacing", description: "Inconsistent spacing between sections" },
      { id: "inconsistent-font-weights", description: "Mixed font weights for the same role" },
    ],
    rubric: {
      weights: { visualHierarchy: 0.5, regressionRisk: 0.3, usability: 0.2 },
    },
    criteria: [
      { id: "c5-hierarchy-spacing", dimension: "visualHierarchy", mandatory: true, tier: 1, addresses: "inconsistent-spacing", description: "Spacing uses one scale" },
      { id: "c5-hierarchy-typography", dimension: "visualHierarchy", mandatory: true, tier: 2, addresses: "inconsistent-font-weights", description: "Font weights match roles" },
      { id: "c5-regression-contract", dimension: "regressionRisk", mandatory: true, tier: 1, description: "Functional contract is unchanged" },
      { id: "c5-usability-scanability", dimension: "usability", mandatory: false, tier: 3, description: "Card content is scannable" },
    ],
  },
];

export const CORPUS = Object.freeze(CASE_ENTRIES.map((c) => Object.freeze(c)));

const REQUIRED_CASE_FIELDS = [
  "id",
  "title",
  "type",
  "baselineRepo",
  "taskSpec",
  "expectedOutcomes",
  "knownDefects",
  "rubric",
  "criteria",
];

const TIERS = new Set([1, 2, 3]);
const WEIGHT_TOLERANCE = 1e-9;

/** @returns {readonly object[]} a shallow copy of the corpus cases. */
export function listCases() {
  return CORPUS.slice();
}

/** @returns {object|null} the case with the given id, or null. */
export function getCase(id) {
  return CORPUS.find((c) => c.id === id) ?? null;
}

/**
 * Structural validation for a corpus. Pure; returns `{ ok, errors }` — never
 * throws, so callers can record validation outcomes in the benchmark envelope.
 */
export function validateCorpus(corpus = CORPUS) {
  const errors = [];
  if (!Array.isArray(corpus) || corpus.length !== 5) {
    errors.push(`corpus must contain exactly 5 cases (got ${Array.isArray(corpus) ? corpus.length : "non-array"})`);
  }
  const seenIds = new Set();
  for (const entry of Array.isArray(corpus) ? corpus : []) {
    const label = entry && entry.id ? entry.id : "<missing id>";
    for (const field of REQUIRED_CASE_FIELDS) {
      if (entry == null || entry[field] == null) errors.push(`${label}: missing required field '${field}'`);
    }
    if (entry == null) continue;
    if (seenIds.has(entry.id)) errors.push(`${label}: duplicate case id`);
    seenIds.add(entry.id);
    if (entry.baselineRepo == null || entry.baselineRepo.snapshotId == null || entry.baselineRepo.commit == null) {
      errors.push(`${label}: baselineRepo must define snapshotId and commit`);
    }
    if (!Array.isArray(entry.expectedOutcomes) || entry.expectedOutcomes.length === 0) {
      errors.push(`${label}: expectedOutcomes must be a non-empty array`);
    } else {
      for (const eo of entry.expectedOutcomes) {
        if (eo == null || typeof eo.id !== "string" || typeof eo.description !== "string" || typeof eo.mandatory !== "boolean") {
          errors.push(`${label}: each expectedOutcome needs { id, description, mandatory }`);
          break;
        }
      }
    }
    if (!Array.isArray(entry.knownDefects)) {
      errors.push(`${label}: knownDefects must be an array (may be empty)`);
    } else {
      for (const d of entry.knownDefects) {
        if (d == null || typeof d.id !== "string" || typeof d.description !== "string") {
          errors.push(`${label}: each knownDefect needs { id, description }`);
          break;
        }
      }
    }
    const weights = entry.rubric && entry.rubric.weights;
    if (weights == null || typeof weights !== "object") {
      errors.push(`${label}: rubric.weights is required`);
    } else {
      let sum = 0;
      for (const [dim, w] of Object.entries(weights)) {
        if (!RUBRIC_DIMENSION_IDS.includes(dim)) errors.push(`${label}: unknown rubric dimension '${dim}' in weights`);
        if (typeof w !== "number" || !Number.isFinite(w) || w < 0) errors.push(`${label}: weight '${dim}' must be a non-negative number`);
        else sum += w;
      }
      if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) errors.push(`${label}: rubric weights must sum to 1 (got ${sum})`);
    }
    if (!Array.isArray(entry.criteria) || entry.criteria.length === 0) {
      errors.push(`${label}: criteria must be a non-empty array`);
    } else {
      const critIds = new Set();
      const dimsUsed = new Set();
      for (const c of entry.criteria) {
        if (c == null || typeof c.id !== "string") { errors.push(`${label}: criterion missing id`); continue; }
        if (critIds.has(c.id)) errors.push(`${label}: duplicate criterion id '${c.id}'`);
        critIds.add(c.id);
        if (!RUBRIC_DIMENSION_IDS.includes(c.dimension)) errors.push(`${label}: criterion '${c.id}' uses unknown dimension '${c.dimension}'`);
        if (typeof c.mandatory !== "boolean") errors.push(`${label}: criterion '${c.id}' must declare mandatory boolean`);
        if (!TIERS.has(c.tier)) errors.push(`${label}: criterion '${c.id}' must have tier in {1,2,3}`);
        dimsUsed.add(c.dimension);
      }
      if (weights && typeof weights === "object") {
        for (const dim of Object.keys(weights)) {
          if (!dimsUsed.has(dim)) errors.push(`${label}: weight '${dim}' has no criterion`);
        }
        for (const dim of dimsUsed) {
          if (!(dim in weights)) errors.push(`${label}: criterion dimension '${dim}' is missing a weight`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
