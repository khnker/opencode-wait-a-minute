import { test } from "node:test";
import assert from "node:assert";
import { loadModelRegistry, resolveSubagentModel, guardSubagentDispatch } from "./subagent-model-availability.js";

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
