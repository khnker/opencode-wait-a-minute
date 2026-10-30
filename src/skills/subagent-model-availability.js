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

// Canonical tier ladder for escalation. `escalateTier` walks this list
// upward; `demoteTier` walks it downward. Tiers not in this list are
// returned unchanged (fail-open: never throw on unknown tier).
export const TIER_LADDER = Object.freeze(["fast", "medium", "heavy"]);

/**
 * Canonical subagent-type → tier mapping. Drives both dispatch and
 * automatic escalation: when a fast subagent fails twice without solving
 * the logic bug, the orchestrator escalates to the next tier in TIER_LADDER.
 */
export const SUBAGENT_TIER_MAP = Object.freeze({
  fast: "fast",
  medium: "medium",
  heavy: "heavy",
  planner: "medium",
  "backend-exec": "fast",
  "frontend-exec": "fast",
  debugger: "fast",
  "arch-review": "medium",
});

/**
 * Resolve the canonical tier for a subagent type and report whether the type is
 * known. Unknown types still fall back to "medium" (fail-open: never block
 * dispatch on an unrecognised type name) but the miss is surfaced to the caller.
 */
export function resolveSubagentTier(subagentType) {
  if (subagentType == null) return { tier: "medium", unknown: false };
  const tier = SUBAGENT_TIER_MAP[String(subagentType).toLowerCase()];
  return tier ? { tier, unknown: false } : { tier: "medium", unknown: true };
}

/**
 * Resolve the canonical tier for a subagent type. Unknown types fall back to
 * "medium" (fail-open: never block dispatch on an unrecognised type name).
 */
export function tierForSubagentType(subagentType) {
  return resolveSubagentTier(subagentType).tier;
}

/**
 * Return the next tier up the ladder, or null if `tier` is already the top.
 * Used by the orchestrator to escalate a failing subagent to a higher tier.
 */
export function escalateTier(tier) {
  const idx = TIER_LADDER.indexOf(tier);
  if (idx < 0) return tier; // unknown tier: fail-open, stay put
  return idx < TIER_LADDER.length - 1 ? TIER_LADDER[idx + 1] : null;
}

/**
 * Return the next tier down the ladder, or null if `tier` is already the bottom.
 */
export function demoteTier(tier) {
  const idx = TIER_LADDER.indexOf(tier);
  if (idx <= 0) return null;
  return TIER_LADDER[idx - 1];
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

export function guardSubagentDispatch(tool, args, { registry, maxDepth = 1, depth = 0, consecutiveFailures = 0, escalateOnFailure = true } = {}) {
  if (tool !== "task" && tool !== "subagent") return { allowed: true };

  if (depth >= maxDepth) {
    return { allowed: false, blocked: true, reason: `subagent depth limit reached (${depth}); decompose instead of recursing` };
  }

  const { subagent_type } = args;
  const { tier: baseTier, unknown: unknownSubagentType } = resolveSubagentTier(subagent_type);

  // Tier escalation: when a subagent has failed consecutively without
  // solving the logic bug, walk up the ladder. 2 consecutive failures is
  // the trigger — matching the "2 turns/failures without solving" rule.
  let effectiveTier = baseTier;
  let escalated = false;
  if (escalateOnFailure && consecutiveFailures >= 2) {
    const next = escalateTier(baseTier);
    if (next && next !== baseTier) {
      effectiveTier = next;
      escalated = true;
    }
  }

  const resolution = resolveSubagentModel(effectiveTier, { registry });

  if (resolution.ok) {
    return {
      allowed: true,
      model: resolution.model,
      tier: resolution.tier,
      baseTier,
      effectiveTier,
      escalated,
      consecutiveFailures,
      ...(unknownSubagentType
        ? {
            unknownSubagentType: true,
            recommendation: `Recomendación: subagent_type "${subagent_type}" no está en SUBAGENT_TIER_MAP; se despacha con el tier "${baseTier}" por defecto. Definí el tipo o corregí el nombre.`,
          }
        : {}),
      reason: escalated
        ? `escalated from ${baseTier} to ${effectiveTier} after ${consecutiveFailures} consecutive failures`
        : resolution.reason,
    };
  }

  return { allowed: false, blocked: true, level: "BLOCKED", reason: resolution.reason };
}
