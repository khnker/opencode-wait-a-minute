import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_FRONTMATTER,
  validateDiscoveryMetadata,
  loadLayers,
  computeMetrics,
  admitByBudget,
} from "./skill-discovery-budget.js";

test("frontmatter exposes the four required fields", () => {
  assert.deepEqual(REQUIRED_FRONTMATTER, ["name", "description", "triggers", "keywords"]);
  const bad = validateDiscoveryMetadata({ name: "x" });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
});

test("description that summarizes workflow warns", () => {
  const r = validateDiscoveryMetadata({
    name: "x",
    description: "First do A then do B",
    triggers: ["t"],
    keywords: ["k"],
  });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
});

test("layered loading: body on activation, references only on demand", () => {
  const layers = loadLayers({ metadata: { name: "x" }, body: "BODY", references: ["ref"] });
  assert.equal(layers.onActivation, "BODY");
  assert.deepEqual(layers.onDemand, ["ref"]);
  assert.equal(layers.alwaysLoaded.name, "x");
});

test("context metrics recorded per activation", () => {
  const m = computeMetrics({ body: "x".repeat(40), references: ["y".repeat(40)] }, { activation_frequency: 3 });
  assert.equal(m.skill_context_tokens, 10);
  assert.equal(m.reference_context_tokens, 10);
  assert.equal(m.total_skill_cost, 20);
  assert.equal(m.activation_frequency, 3);
});

test("budget admission admits or rejects", () => {
  const ok = admitByBudget({ total_skill_cost: 20 }, { maxTotalSkillCost: 100, used: 50, reserved: 10 });
  assert.equal(ok.admitted, true);
  assert.equal(ok.available, 40);
  const over = admitByBudget({ total_skill_cost: 60 }, { maxTotalSkillCost: 100, used: 50, reserved: 10 });
  assert.equal(over.admitted, false);
  assert.equal(over.reason, "over_budget");
});
