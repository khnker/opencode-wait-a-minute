// CH-07 skill discovery + context budget: discovery metadata validation, layered
// loading, per-activation context metrics, and budget admission.

export const REQUIRED_FRONTMATTER = ["name", "description", "triggers", "keywords"];

const WORKFLOW_IN_DESCRIPTION = /(\bstep\s*\d|\bfirst\b|\bthen\b|->|→|\n\s*\d+\.)/i;

export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function validateDiscoveryMetadata(meta = {}) {
  const errors = [];
  const warnings = [];
  for (const field of REQUIRED_FRONTMATTER) {
    if (typeof meta[field] === "undefined") errors.push(`missing frontmatter: ${field}`);
  }
  if (meta.description && WORKFLOW_IN_DESCRIPTION.test(meta.description)) {
    warnings.push("description summarizes workflow; it SHOULD describe WHEN to activate");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function loadLayers(skill = {}) {
  return {
    alwaysLoaded: skill.metadata || { name: skill.name, description: skill.description },
    onActivation: skill.body || "",
    onDemand: skill.references || [],
  };
}

export function computeMetrics(skill = {}, usage = {}) {
  const skill_context_tokens = estimateTokens(skill.body || "");
  const reference_context_tokens = (skill.references || []).reduce(
    (acc, ref) => acc + estimateTokens(typeof ref === "string" ? ref : ref.content || ""),
    0,
  );
  return {
    skill_context_tokens,
    reference_context_tokens,
    total_skill_cost: skill_context_tokens + reference_context_tokens,
    activation_frequency: usage.activation_frequency || usage.activations || 0,
  };
}

export function admitByBudget(metrics = {}, budget = {}) {
  const max = budget.maxTotalSkillCost || 0;
  const used = budget.used || 0;
  const reserved = budget.reserved || 0;
  const available = max - used - reserved;
  const admitted = metrics.total_skill_cost <= available;
  return { admitted, available, reason: admitted ? "within_budget" : "over_budget" };
}
