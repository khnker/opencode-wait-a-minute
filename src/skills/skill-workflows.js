// CH-04 workflow engine: declarative, opt-in composition of registered skills.
// Distinct from an atomic skill; supports required/optional/conditional/parallel/
// retry/fallback modifiers, persistent + branching state, bounded retries, and
// verifiable termination (delegates final verification to CH-05).

export const STEP_MODIFIERS = ["required", "optional", "conditional", "parallel", "retry", "fallback"];

export const WORKFLOW_STATUS = {
  RUNNING: "RUNNING",
  AWAITING_VERIFICATION: "AWAITING_VERIFICATION",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
};

export function validateWorkflow(workflow, registrySkills = []) {
  const errors = [];
  if (!workflow || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return { ok: false, errors: ["workflow.steps (non-empty) required"] };
  }
  const ids = new Set(registrySkills);
  workflow.steps.forEach((step, i) => {
    if (!step.skill) errors.push(`step ${i}: skill required`);
    else if (ids.size && !ids.has(step.skill)) errors.push(`step ${i}: unknown skill ${step.skill}`);
  });
  return { ok: errors.length === 0, errors };
}

export function createWorkflowState(workflow) {
  return {
    workflowId: workflow.name,
    cursor: 0,
    status: WORKFLOW_STATUS.RUNNING,
    startedAt: Date.now(),
    retries: {},
    visited: [],
    skipped: [],
    branches: [],
    evidence: [],
  };
}

function finish(state, workflow) {
  if (state.cursor >= workflow.steps.length && state.status === WORKFLOW_STATUS.RUNNING) {
    state.status = WORKFLOW_STATUS.AWAITING_VERIFICATION;
  }
  return state;
}

export function stepWorkflow(state, workflow, context = {}) {
  if (state.status !== WORKFLOW_STATUS.RUNNING) return state;
  const next = {
    ...state,
    retries: { ...state.retries },
    visited: [...state.visited],
    skipped: [...state.skipped],
    branches: [...state.branches],
    evidence: [...state.evidence],
  };
  const step = workflow.steps[next.cursor];
  if (!step) return finish(next, workflow);

  if (step.condition && !(context.conditions && context.conditions[step.condition])) {
    next.skipped.push(step.skill);
    next.cursor += 1;
    return finish(next, workflow);
  }

  const outcome = context.outcomes ? context.outcomes[step.skill] : undefined;

  if (outcome === "fail") {
    const max = step.retry ? step.retry.max : 0;
    const used = next.retries[step.skill] || 0;
    if (used < max) {
      next.retries[step.skill] = used + 1;
      return next;
    }
    if (step.fallback) {
      next.branches.push({ skill: step.skill, fallback: step.fallback });
      next.visited.push(step.fallback);
      next.cursor += 1;
      return finish(next, workflow);
    }
    next.status = WORKFLOW_STATUS.FAILED;
    return next;
  }

  if (outcome === undefined) {
    if (step.optional || step.condition) {
      next.skipped.push(step.skill);
      next.cursor += 1;
      return finish(next, workflow);
    }
    next.status = WORKFLOW_STATUS.FAILED;
    return next;
  }

  next.visited.push(step.skill);
  if (step.parallel) next.branches.push({ parallel: step.skill });
  next.cursor += 1;
  return finish(next, workflow);
}

export function resumeWorkflow(state) {
  return { cursor: state.cursor, status: state.status, retries: { ...state.retries }, skipped: [...state.skipped] };
}

export function verifyWorkflow(state, evidence) {
  if (state.status !== WORKFLOW_STATUS.AWAITING_VERIFICATION) {
    return { ...state, error: "not_awaiting_verification" };
  }
  return { ...state, status: WORKFLOW_STATUS.VERIFIED, evidence: [...(state.evidence || []), evidence] };
}

export function selectWorkflow() {
  return null;
}
