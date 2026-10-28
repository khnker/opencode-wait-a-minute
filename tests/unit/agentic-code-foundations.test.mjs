import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRegistry, routeSkillsV2 } from "../../src/skills/engine.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";
import { getSkillConstraints } from "../../src/skills/skill-routing.js";

const SKILL_ID = "agentic-code-foundations";

function buildRealRegistry() {
  const available = discoverSkills({ root: process.cwd() });
  return buildRegistry(available, process.cwd());
}

describe("agentic-code-foundations skill", () => {
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
    assert.strictEqual(entry.risk, "low");
    assert.strictEqual(entry.loadStrategy, "ondemand");
    assert.ok(entry.capabilities.length > 0, "capabilities must not be empty");
    assert.ok(entry.triggers.length > 0, "triggers must not be empty");
    assert.ok(entry.content.includes("# Agentic Code Foundations"));
    assert.ok(entry.content.includes("shortcut: <limitation>; upgrade when <condition>"));
  });

  it("is selected for a refactor/maintainability prompt", () => {
    const taskRoot = mkdtempSync(join(tmpdir(), "wam-acf-"));
    mkdirSync(join(taskRoot, ".wam"), { recursive: true });
    const { registry } = buildRealRegistry();

    const result = routeSkillsV2(
      "refactor this code for maintainability and agent-readable clarity",
      {},
      registry,
      "STANDARD",
      { minSkillScore: 0, projectRoot: taskRoot },
    );

    const ids = result.selected.map((s) => s.id ?? s.name);
    assert.ok(ids.includes(SKILL_ID), `expected ${SKILL_ID} in ${ids.join(", ")}`);
    const selected = result.selected.find((s) => (s.id ?? s.name) === SKILL_ID);
    assert.notStrictEqual(selected.base, true, "must load on demand, not as base");
  });

  it("declares a cross-layer constraint", () => {
    const constraint = getSkillConstraints(SKILL_ID);
    assert.deepStrictEqual(constraint.allowedLayers, [
      "backend",
      "frontend",
      "shared",
      "infrastructure",
    ]);
  });

  it("keeps the routing constraint in the routing module source", () => {
    const source = readFileSync(
      join(process.cwd(), "src/skills/skill-routing.js"),
      "utf8",
    );
    assert.ok(source.includes(`"${SKILL_ID}"`), "constraint should reference the skill id");
  });
});
