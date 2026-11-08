import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { buildRegistry, routeSkillsV2 } from "../../src/skills/engine.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";

const SKILL_ID = "verify";

function buildRealRegistry() {
  const available = discoverSkills({ root: process.cwd() });
  const { registry } = buildRegistry(available, process.cwd());
  return { available, registry };
}

describe("verify skill", () => {
  it("is discoverable from the bundled skills directory", () => {
    const available = discoverSkills({ root: process.cwd() });
    assert.ok(available[SKILL_ID], `${SKILL_ID} should be discovered`);
    assert.ok(
      available[SKILL_ID].path.endsWith(join("skills", SKILL_ID, "SKILL.md")),
      `unexpected path: ${available[SKILL_ID].path}`,
    );
  });

  it("is approved, on-demand, and carries its prompt content", () => {
    const { registry } = buildRealRegistry();
    const entry = registry[SKILL_ID];

    assert.ok(entry, `${SKILL_ID} should be in the registry`);
    assert.strictEqual(entry.status, "APPROVED");
    assert.strictEqual(entry.risk, "medium");
    assert.notStrictEqual(entry.loadStrategy, "base");
    assert.ok(entry.capabilities.includes("verification"));
    assert.ok(entry.triggers.includes("verify"));
    assert.ok(entry.content.includes("# Verify"));
    assert.ok(entry.content.includes("Runtime invariants"));
    assert.ok(entry.content.includes("evaluateCompletionGate"));
  });

  it("routes verification and completion prompts", () => {
    const { registry } = buildRealRegistry();
    const result = routeSkillsV2(
      "verify the task with evidence before done",
      {},
      registry,
      "STANDARD",
    );
    assert.ok(
      result.selected.some((skill) => skill.id === SKILL_ID),
      `verify should be selected, got: ${result.selected.map((skill) => skill.id).join(",")}`,
    );
  });

  it("requires a Craftsman review as part of the done gate", () => {
    const { registry } = buildRealRegistry();
    const content = registry[SKILL_ID].content;
    for (const marker of ["Craftsman review", "Diff Audit", "KISS", "DRY"]) {
      assert.ok(
        content.includes(marker),
        `verify skill should mention ${marker} in its completion gate`,
      );
    }
  });

  it("routes accented Spanish verification prompts", () => {
    const { registry } = buildRealRegistry();
    const result = routeSkillsV2(
      "Verificá con evidencia antes de completar",
      {},
      registry,
      "STANDARD",
    );
    assert.ok(
      result.selected.some((skill) => skill.id === SKILL_ID),
      `verify should be selected, got: ${result.selected.map((skill) => skill.id).join(",")}`,
    );
  });
});
