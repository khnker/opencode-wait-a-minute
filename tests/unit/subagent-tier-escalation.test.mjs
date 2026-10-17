import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  TIER_LADDER,
  SUBAGENT_TIER_MAP,
  tierForSubagentType,
  escalateTier,
  demoteTier,
  resolveSubagentModel,
  guardSubagentDispatch,
} from "../../src/skills/subagent-model-availability.js";

const registry = {
  tiers: {
    fast: ["omni/free-stack"],
    medium: ["omni2/coding"],
    heavy: ["omni2/coding-pro"],
  },
  activePreset: "omni",
};

test("TIER_LADDER is canonical and frozen", () => {
  assert.deepStrictEqual([...TIER_LADDER], ["fast", "medium", "heavy"]);
  assert.strictEqual(Object.isFrozen(TIER_LADDER), true);
});

test("SUBAGENT_TIER_MAP covers all subagent types", () => {
  assert.strictEqual(SUBAGENT_TIER_MAP.fast, "fast");
  assert.strictEqual(SUBAGENT_TIER_MAP.medium, "medium");
  assert.strictEqual(SUBAGENT_TIER_MAP.heavy, "heavy");
  assert.strictEqual(SUBAGENT_TIER_MAP["backend-exec"], "medium");
  assert.strictEqual(SUBAGENT_TIER_MAP["frontend-exec"], "medium");
  assert.strictEqual(SUBAGENT_TIER_MAP.planner, "medium");
  assert.strictEqual(SUBAGENT_TIER_MAP.debugger, "medium");
  assert.strictEqual(SUBAGENT_TIER_MAP["arch-review"], "medium");
});

test("tierForSubagentType maps known types", () => {
  assert.strictEqual(tierForSubagentType("fast"), "fast");
  assert.strictEqual(tierForSubagentType("heavy"), "heavy");
  assert.strictEqual(tierForSubagentType("backend-exec"), "medium");
});

test("tierForSubagentType falls back to medium for unknown", () => {
  assert.strictEqual(tierForSubagentType("unknown"), "medium");
  assert.strictEqual(tierForSubagentType(null), "medium");
  assert.strictEqual(tierForSubagentType(undefined), "medium");
});

test("escalateTier walks up the ladder", () => {
  assert.strictEqual(escalateTier("fast"), "medium");
  assert.strictEqual(escalateTier("medium"), "heavy");
  assert.strictEqual(escalateTier("heavy"), null);
});

test("escalateTier fails open for unknown tier", () => {
  assert.strictEqual(escalateTier("nonexistent"), "nonexistent");
});

test("demoteTier walks down the ladder", () => {
  assert.strictEqual(demoteTier("heavy"), "medium");
  assert.strictEqual(demoteTier("medium"), "fast");
  assert.strictEqual(demoteTier("fast"), null);
});

test("resolveSubagentModel finds model in tier", () => {
  const r = resolveSubagentModel("fast", { registry });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.model, "omni/free-stack");
  assert.strictEqual(r.tier, "fast");
});

test("resolveSubagentModel fails for empty registry", () => {
  const r = resolveSubagentModel("fast", { registry: { tiers: {} } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.model, null);
});

test("guardSubagentDispatch allows non-task tools", () => {
  const r = guardSubagentDispatch("read", {}, { registry });
  assert.strictEqual(r.allowed, true);
});

test("guardSubagentDispatch allows fast subagent at depth 0", () => {
  const r = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry, maxDepth: 1, depth: 0 });
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.model, "omni/free-stack");
  assert.strictEqual(r.tier, "fast");
  assert.strictEqual(r.escalated, false);
});

test("guardSubagentDispatch blocks at maxDepth", () => {
  const r = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry, maxDepth: 1, depth: 1 });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.blocked, true);
  assert.match(r.reason, /depth limit reached/);
});

test("guardSubagentDispatch escalates tier after 2 consecutive failures", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "fast" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 2 }
  );
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.escalated, true);
  assert.strictEqual(r.baseTier, "fast");
  assert.strictEqual(r.effectiveTier, "medium");
  assert.strictEqual(r.model, "omni2/coding");
  assert.match(r.reason, /escalated from fast to medium/);
});

test("guardSubagentDispatch escalates from medium to heavy after 2 failures", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "medium" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 2 }
  );
  assert.strictEqual(r.escalated, true);
  assert.strictEqual(r.effectiveTier, "heavy");
  assert.strictEqual(r.model, "omni2/coding-pro");
});

test("guardSubagentDispatch does not escalate at top tier", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "heavy" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 5 }
  );
  assert.strictEqual(r.escalated, false);
  assert.strictEqual(r.effectiveTier, "heavy");
});

test("guardSubagentDispatch does not escalate below threshold", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "fast" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 1 }
  );
  assert.strictEqual(r.escalated, false);
  assert.strictEqual(r.effectiveTier, "fast");
});

test("guardSubagentDispatch can disable escalation", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "fast" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 5, escalateOnFailure: false }
  );
  assert.strictEqual(r.escalated, false);
  assert.strictEqual(r.effectiveTier, "fast");
});

test("guardSubagentDispatch maps backend-exec to medium tier", () => {
  const r = guardSubagentDispatch(
    "task",
    { subagent_type: "backend-exec" },
    { registry, maxDepth: 1, depth: 0, consecutiveFailures: 2 }
  );
  assert.strictEqual(r.baseTier, "medium");
  assert.strictEqual(r.effectiveTier, "heavy");
});