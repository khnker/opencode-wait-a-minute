import fs from "node:fs";
import path from "node:path";

export function loadModelRegistry({ configPath, env = process.env } = {}) {
  try {
    const configData = env.WAM_MODEL_REGISTRY
      ? JSON.parse(env.WAM_MODEL_REGISTRY)
      : JSON.parse(fs.readFileSync(configPath || "/dev/null", "utf-8"));

    return {
      tiers: configData.presets[configData.activePreset] || {},
      activePreset: configData.activePreset,
    };
  } catch (e) {
    return { tiers: {}, activePreset: null };
  }
}

export function resolveSubagentModel(tier, { registry, fallbackChain = [] } = {}) {
  const models = registry.tiers[tier] || [];
  const chain = [tier, ...fallbackChain];

  for (const t of chain) {
    const candidates = registry.tiers[t] || [];
    for (const model of candidates) {
      // In a real implementation, we would check if the model is available.
      // For now, we assume if it's in the registry, it's a candidate.
      return { ok: true, model, tier: t, hops: chain.indexOf(t), reason: "model found" };
    }
  }

  return { ok: false, model: null, tier: null, hops: 0, reason: `no model found in tier ${tier}` };
}

export function guardSubagentDispatch(tool, args, { registry, maxDepth = 1, depth = 0 } = {}) {
  if (tool !== "task" && tool !== "subagent") return { allowed: true };

  if (depth >= maxDepth) {
    return { allowed: false, blocked: true, reason: `subagent depth limit reached (${depth}); decompose instead of recursing` };
  }

  const { subagent_type } = args;
  const resolution = resolveSubagentModel(subagent_type, { registry });
  
  if (resolution.ok) {
    return { allowed: true, model: resolution.model, tier: resolution.tier, reason: resolution.reason };
  }

  return { allowed: false, blocked: true, level: "BLOCKED", reason: resolution.reason };
}
