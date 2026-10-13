/**
 * Comparison engine for two frozen runs.
 *
 * Uses frozen snapshots to ensure comparison is immune to live file edits (PQ-004).
 */

import { diffAgainstSnapshot } from "./snapshot.mjs";
import { classify } from "./decision.mjs";

export function compareRuns(baselineRun, candidateRun) {
  // In wam.prompt-eval.run/1, labels is an array. We assume a single-label run.
  const b = baselineRun.labels?.[0];
  const c = candidateRun.labels?.[0];

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
    equivalentConfig: true,
  };
}
