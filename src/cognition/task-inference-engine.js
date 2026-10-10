/**
 * Task Inference Engine — infers non-implicit tasks and robust completion criteria.
 *
 * Given a task list, this engine:
 *  1. Infers next tasks that the planner/agent should consider but are not
 *     explicitly stated (verification, rollback, documentation, monitoring).
 *  2. Generates robust completion criteria (local service check, partial
 *     data review, validation) so "done" is falsifiable.
 *
 * Design rules:
 *  - Pure functions, no I/O. Deterministic for a given input.
 *  - Inferred tasks are marked `implicit: false` to make explicit that the
 *    inference itself was non-implicit in the source list.
 *  - Completion criteria include a `weight` (0..1) so callers can decide
 *    what fraction of criteria must pass before claiming completion.
 *  - Idempotent: running `inferNextTasks` twice yields the same result.
 */

export const COMPLETION_TYPE = Object.freeze({
  LOCAL_SERVICE: "LOCAL_SERVICE_CHECK",
  DATA_REVIEW: "DATA_REVIEW",
  VALIDATION: "VALIDATION",
  ROLLBACK_PLAN: "ROLLBACK_PLAN",
  DOCUMENTATION: "DOCUMENTATION",
  MONITORING: "MONITORING",
});

/**
 * Largest-remainder normalization: scales raw weights so they sum to exactly
 * 1.0 while keeping each weight quantized to 4 decimal places.
 */
function normalizeWeights(criteria) {
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return;
  const SCALE = 10000;
  const scaled = criteria.map((c) => (c.weight / total) * SCALE);
  const floors = scaled.map((v) => Math.floor(v));
  const remainders = scaled.map((v, i) => ({ i, frac: v - floors[i] }));
  let deficit = SCALE - floors.reduce((s, v) => s + v, 0);
  remainders.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < deficit; k += 1) {
    floors[remainders[k].i] += 1;
  }
  for (let i = 0; i < criteria.length; i += 1) {
    criteria[i].weight = floors[i] / SCALE;
  }
}

// Heuristics mapping task tags → which verification tasks to infer.
// Each entry defines: id, description, completionCriteria, dependsOn.
const VERIFICATION_TEMPLATES = {
  verification: {
    idSuffix: "-verify",
    descriptionPrefix: "Verify",
    criteria: () => [
      {
        type: COMPLETION_TYPE.VALIDATION,
        description: "Automated validation pass (lint/type/test)",
        weight: 0.5,
      },
      {
        type: COMPLETION_TYPE.LOCAL_SERVICE,
        description: "Local service health check (smoke endpoint)",
        weight: 0.3,
      },
    ],
  },
  data: {
    idSuffix: "-review",
    descriptionPrefix: "Review",
    criteria: () => [
      {
        type: COMPLETION_TYPE.DATA_REVIEW,
        description: "10% sample manual data review",
        weight: 0.4,
      },
      {
        type: COMPLETION_TYPE.VALIDATION,
        description: "Schema/integrity validation",
        weight: 0.4,
      },
    ],
  },
  deploy: {
    idSuffix: "-rollback",
    descriptionPrefix: "Prepare rollback for",
    criteria: () => [
      {
        type: COMPLETION_TYPE.ROLLBACK_PLAN,
        description: "Rollback plan documented and rehearsed",
        weight: 0.6,
      },
    ],
  },
  service: {
    idSuffix: "-monitor",
    descriptionPrefix: "Monitor",
    criteria: () => [
      {
        type: COMPLETION_TYPE.MONITORING,
        description: "Metrics/logs dashboard wired up",
        weight: 0.5,
      },
      {
        type: COMPLETION_TYPE.LOCAL_SERVICE,
        description: "Local service health probe",
        weight: 0.3,
      },
    ],
  },
  public: {
    idSuffix: "-docs",
    descriptionPrefix: "Document",
    criteria: () => [
      {
        type: COMPLETION_TYPE.DOCUMENTATION,
        description: "User-facing documentation published",
        weight: 0.5,
      },
    ],
  },
};

/**
 * Infer next (non-implicit) tasks from a task list.
 *
 * @param {Array<{id: string, description?: string, tags?: string[], requiresVerification?: boolean, dataIntensive?: boolean, isService?: boolean}>} taskList
 * @param {{ minCompletionWeight?: number }} [context]
 * @returns {Array<{id: string, description: string, implicit: false, dependsOn: string[], completionCriteria: Array<{type: string, description: string, weight: number}>}>}
 */
export function inferNextTasks(taskList, context = {}) {
  if (!Array.isArray(taskList)) {
    throw new TypeError("inferNextTasks: taskList must be an array");
  }
  const inferred = [];
  const existingIds = new Set(taskList.map((t) => t.id));

  for (const task of taskList) {
    if (!task || typeof task.id !== "string") continue;
    const tags = Array.isArray(task.tags) ? task.tags : [];

    // Map heuristics: explicit flags first, then tags.
    const matches = [];
    if (task.requiresVerification) matches.push(VERIFICATION_TEMPLATES.verification);
    if (task.dataIntensive) matches.push(VERIFICATION_TEMPLATES.data);
    if (task.isService) matches.push(VERIFICATION_TEMPLATES.service);
    if (tags.includes("deploy")) matches.push(VERIFICATION_TEMPLATES.deploy);
    if (tags.includes("public") || tags.includes("breaking")) {
      matches.push(VERIFICATION_TEMPLATES.public);
    }

    for (const tpl of matches) {
      const newId = `${task.id}${tpl.idSuffix}`;
      if (existingIds.has(newId)) continue; // idempotent
      existingIds.add(newId);
      inferred.push({
        id: newId,
        description: `${tpl.descriptionPrefix} ${task.description ?? task.id}`.trim(),
        implicit: false,
        dependsOn: [task.id],
        completionCriteria: tpl.criteria(),
      });
    }
  }

  // Normalize weights in-place so the sum equals exactly 1.0
  // Use largest-remainder allocation so the rounded weights sum to 1.0.
  for (const task of inferred) {
    normalizeWeights(task.completionCriteria);
  }

  return inferred;
}

/**
 * Generate robust completion criteria for a single task.
 *
 * Combines task-flag-driven criteria with a baseline of validation so every
 * task has at least one falsifiable completion check.
 *
 * @param {{dataIntensive?: boolean, isService?: boolean, tags?: string[], id?: string}} task
 * @param {{ minCompletionWeight?: number }} [context]
 * @returns {Array<{type: string, description: string, weight: number}>}
 */
export function generateCompletionCriteria(task, context = {}) {
  if (!task || typeof task !== "object") {
    throw new TypeError("generateCompletionCriteria: task must be an object");
  }
  const minWeight = context.minCompletionWeight ?? 0.6;
  const criteria = [];
  const tags = Array.isArray(task.tags) ? task.tags : [];

  if (task.dataIntensive) {
    criteria.push({
      type: COMPLETION_TYPE.DATA_REVIEW,
      description: "10% sample manual data review",
      weight: 0.4,
    });
  }
  if (task.isService || tags.includes("service")) {
    criteria.push({
      type: COMPLETION_TYPE.LOCAL_SERVICE,
      description: "Local service health check (smoke endpoint)",
      weight: 0.4,
    });
  }
  if (tags.includes("deploy")) {
    criteria.push({
      type: COMPLETION_TYPE.ROLLBACK_PLAN,
      description: "Rollback plan documented and rehearsed",
      weight: 0.6,
    });
  }
  if (tags.includes("public") || tags.includes("breaking")) {
    criteria.push({
      type: COMPLETION_TYPE.DOCUMENTATION,
      description: "User-facing documentation published",
      weight: 0.5,
    });
  }

  // Baseline: every task has at least one validation criterion.
  criteria.push({
    type: COMPLETION_TYPE.VALIDATION,
    description: `Automated validation pass for ${task.id ?? "task"}`,
    weight: 0.3,
  });

  // Normalize weights so the sum equals 1.0 (callers can rely on the ratio).
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  if (total > 0) {
    normalizeWeights(criteria);
  }

  return Object.freeze(
    criteria.map((c) => Object.freeze({ ...c }))
  );
}

/**
 * Decide if a task can be claimed complete given observed criteria passes.
 *
 * @param {Array<{type: string, weight: number, passed?: boolean}>} criteria
 * @param {{ minCompletionWeight?: number }} [context]
 * @returns {{ canComplete: boolean, achievedWeight: number, missing: string[] }}
 */
export function evaluateCompletion(criteria, context = {}) {
  if (!Array.isArray(criteria)) {
    throw new TypeError("evaluateCompletion: criteria must be an array");
  }
  const minWeight = context.minCompletionWeight ?? 0.6;
  let achieved = 0;
  const missing = [];
  for (const c of criteria) {
    if (c.passed) {
      achieved += c.weight;
    } else {
      missing.push(c.type);
    }
  }
  const achievedRounded = +achieved.toFixed(4);
  return {
    canComplete: achievedRounded >= minWeight,
    achievedWeight: achievedRounded,
    missing,
  };
}
