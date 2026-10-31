import { test } from "node:test";
import assert from "node:assert";
import { loadModelRegistry, resolveSubagentModel, resolveSubagentTier, guardSubagentDispatch } from "./subagent-model-availability.js";

test("loadModelRegistry - fails open on missing file", () => {
  const registry = loadModelRegistry({ configPath: "/non-existent" });
  assert.strictEqual(registry.activePreset, null);
  assert.deepStrictEqual(registry.tiers, {});
});

test("resolveSubagentModel - finds model", () => {
  const registry = { tiers: { fast: ["model-a"] }, activePreset: "p" };
  const res = resolveSubagentModel("fast", { registry });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.model, "model-a");
});

test("resolveSubagentModel - falls back", () => {
  const registry = { tiers: { fast: [], medium: ["model-b"] }, activePreset: "p" };
  const res = resolveSubagentModel("fast", { registry, fallbackChain: ["medium"] });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.model, "model-b");
  assert.strictEqual(res.tier, "medium");
});

test("guardSubagentDispatch - blocks on no model", () => {
  const registry = { tiers: { fast: [] }, activePreset: "p" };
  const res = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry });
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.blocked, true);
});

test("guardSubagentDispatch - blocks on depth limit", () => {
  const registry = { tiers: { fast: ["model-a"] }, activePreset: "p" };
  const res = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry, maxDepth: 1, depth: 1 });
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.blocked, true);
  assert.ok(res.reason.includes("depth limit"));
});

test("guardSubagentDispatch - passes through non-task", () => {
  const res = guardSubagentDispatch("other", {}, {});
  assert.strictEqual(res.allowed, true);
});

test("resolveSubagentTier - known types map unchanged", () => {
  assert.deepStrictEqual(resolveSubagentTier("fast"), { tier: "fast", unknown: false });
  assert.deepStrictEqual(resolveSubagentTier("Heavy"), { tier: "heavy", unknown: false });
  assert.deepStrictEqual(resolveSubagentTier("planner"), { tier: "medium", unknown: false });
  assert.deepStrictEqual(resolveSubagentTier(null), { tier: "medium", unknown: false });
});

test("resolveSubagentTier - unknown type defaults to medium and is flagged", () => {
  assert.deepStrictEqual(resolveSubagentTier("wizard"), { tier: "medium", unknown: true });
});

test("guardSubagentDispatch - unknown type stays allowed and surfaces a recommendation", () => {
  const registry = { tiers: { medium: ["model-m"] }, activePreset: "p" };
  const res = guardSubagentDispatch("task", { subagent_type: "wizard" }, { registry });
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.unknownSubagentType, true);
  assert.ok(res.recommendation.includes("wizard"));
  assert.ok(res.recommendation.includes("medium"));
});

test("guardSubagentDispatch - known type carries no recommendation", () => {
  const registry = { tiers: { fast: ["model-a"] }, activePreset: "p" };
  const res = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry });
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.unknownSubagentType, undefined);
  assert.strictEqual(res.recommendation, undefined);
});

test("guardSubagentDispatch - escalation still walks fast to medium", () => {
  const registry = { tiers: { fast: ["model-a"], medium: ["model-m"] }, activePreset: "p" };
  const res = guardSubagentDispatch("task", { subagent_type: "fast" }, { registry, consecutiveFailures: 2 });
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.baseTier, "fast");
  assert.strictEqual(res.effectiveTier, "medium");
  assert.strictEqual(res.escalated, true);
});

test("guardSubagentDispatch - unknown type never throws", () => {
  assert.doesNotThrow(() => guardSubagentDispatch("task", { subagent_type: "wizard" }, { registry: { tiers: {} } }));
});
