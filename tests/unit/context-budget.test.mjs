import test from "node:test";
import assert from "node:assert/strict";

import { applyContextBudget, budgetForState } from "../../src/context/context-budget.js";

test("conversation budget is smaller than task budget", () => {
  assert.ok(budgetForState("CONVERSATION").maxItems < budgetForState("TASK_NEW").maxItems);
});

test("budget caps items and deduplicates", () => {
  const items = ["a", "a", "b", "c", "d", "e"];
  const kept = applyContextBudget(items, { state: "CONVERSATION" });
  assert.ok(kept.length <= budgetForState("CONVERSATION").maxItems);
  assert.equal(new Set(kept).size, kept.length);
});

test("token budget stops before exceeding the cap", () => {
  const items = ["a".repeat(100), "b".repeat(100), "c".repeat(100), "d".repeat(100), "e".repeat(100)];
  const kept = applyContextBudget(items, { state: "CONVERSATION", estimateTokens: (t) => t.length });
  assert.ok(kept.length < items.length);
});
