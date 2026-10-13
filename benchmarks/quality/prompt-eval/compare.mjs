/**
 * Comparison engine for two frozen runs.
 *
 * Uses frozen snapshots to ensure comparison is immune to live file edits (PQ-004).
 */

import { diffAgainstSnapshot } from "./snapshot.mjs";
import { classify } from "./decision.mjs";

function selectLabelRecord(run, label) {
  const labels = run.labels || [];
  if (label) {
    const found = labels.find((l) => l.label === label);
    if (!found) {
      throw new Error(`prompt-eval: label "${label}" not found in run`);
    }
    return found;
  }
  if (labels.length === 1) {
    return labels[0];
  }
  throw new Error("prompt-eval: ambiguous label — run has multiple labels and none was explicitly selected");
}

function requiredCriterionIds(detail) {
  return (detail.criteria || [])
    .filter((c) => c.required)
    .map((c) => c.criterionId)
    .sort();
}

function assertCoverageMatch(baseline, candidate) {
  const bDetails = baseline.details;
  const cDetails = candidate.details;

  // An interrupted/partial run carries no per-scenario details. That is NOT a
  // coverage mismatch: the comparison proceeds so `classify` can yield
  // INCONCLUSIVE for the empty/partial side (PQ-INT-002).
  if (!Array.isArray(bDetails) || bDetails.length === 0 ||
      !Array.isArray(cDetails) || cDetails.length === 0) {
    return;
  }

  const bIds = bDetails.map((d) => d.scenarioId).sort();
  const cIds = cDetails.map((d) => d.scenarioId).sort();
  if (bIds.length !== cIds.length || bIds.some((id, i) => id !== cIds[i])) {
    throw new Error("prompt-eval: coverage mismatch — runs cover different scenario sets");
  }

  for (const bDetail of bDetails) {
    const cDetail = cDetails.find((d) => d.scenarioId === bDetail.scenarioId);
    const bRequired = requiredCriterionIds(bDetail);
    const cRequired = requiredCriterionIds(cDetail);
    if (bRequired.length !== cRequired.length || bRequired.some((id, i) => id !== cRequired[i])) {
      throw new Error(
        `prompt-eval: coverage mismatch — required criterion ids differ for scenario ${bDetail.scenarioId}`,
      );
    }
  }
}

export function compareRuns(baselineRun, candidateRun, { label } = {}) {
  const b = selectLabelRecord(baselineRun, label);
  const c = selectLabelRecord(candidateRun, label);

  if (!b || !c) {
    throw new Error("prompt-eval: run records must contain at least one label");
  }

  // PQ-INT-04: Reject non-equivalent datasets/configs
  if (!b.suite || !c.suite ||
      b.suite.id !== c.suite.id ||
      b.suite.version !== c.suite.version) {
    throw new Error("prompt-eval: cannot compare runs from different suites/versions");
  }
  if (b.configHash !== c.configHash) {
    throw new Error("prompt-eval: config mismatch between baseline and candidate");
  }

  assertCoverageMatch(b, c);

  const equivalentConfig = b.suite.id === c.suite.id &&
    b.suite.version === c.suite.version &&
    b.configHash === c.configHash;

  // Use snapshots for content diff (PQ-004)
  const bPrompts = new Map(b.prompts.map(p => [p.id, p.hash]));
  const cPrompts = new Map(c.prompts.map(p => [p.id, p.hash]));

  const changed = [];
  const unchanged = [];
  const removed = [];
  const added = [];

  for (const [id, hash] of bPrompts) {
    if (!cPrompts.has(id)) {
      removed.push(id);
    } else if (cPrompts.get(id) === hash) {
      unchanged.push(id);
    } else {
      changed.push(id);
    }
  }
  for (const id of cPrompts.keys()) {
    if (!bPrompts.has(id)) added.push(id);
  }

  return {
    promptDiff: { changed, unchanged, added, removed },
    decision: classify(
      { metrics: b.metrics || {}, details: b.details || [] },
      { metrics: c.metrics || {}, details: c.details || [] },
    ),
    equivalentConfig,
  };
}
