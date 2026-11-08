import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildRegistry, routeSkillsV2 } from "../../src/skills/engine.js";
import { assembleContext } from "../../src/context/assembly.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";
import { getSkillConstraints } from "../../src/skills/skill-routing.js";

const SKILL_ID = "craftsman";

function buildRealRegistry() {
  const available = discoverSkills({ root: process.cwd() });
  return buildRegistry(available, process.cwd());
}

describe("craftsman skill", () => {
  it("is discoverable from the bundled skills directory", () => {
    const available = discoverSkills({ root: process.cwd() });
    assert.ok(available[SKILL_ID], `${SKILL_ID} should be discovered`);
    assert.ok(
      available[SKILL_ID].path.endsWith(join("skills", SKILL_ID, "SKILL.md")),
      `unexpected path: ${available[SKILL_ID].path}`,
    );
  });

  it("is approved, base, and carries its prompt content", () => {
    const { registry } = buildRealRegistry();
    const entry = registry[SKILL_ID];

    assert.ok(entry, `${SKILL_ID} should be in the registry`);
    assert.strictEqual(entry.status, "APPROVED");
    assert.strictEqual(entry.risk, "low");
    assert.strictEqual(entry.loadStrategy, "base");
    assert.ok(entry.capabilities.length > 0, "capabilities must not be empty");
    assert.ok(entry.triggers.length > 0, "triggers must not be empty");
    assert.ok(entry.content.includes("# Craftsman"));
    assert.ok(entry.content.includes("Craftsman Ladder"));
  });

  it("replaces ponytail as the base skill", () => {
    const { registry } = buildRealRegistry();
    assert.strictEqual(registry[SKILL_ID]?.loadStrategy, "base");
    assert.notStrictEqual(
      registry["dietrichgebert-ponytail-ponytail"]?.loadStrategy,
      "base",
      "ponytail must not remain a base skill",
    );
  });

  it("uses the updated description without encoding the workflow", () => {
    const source = readFileSync(
      join(process.cwd(), "skills", SKILL_ID, "SKILL.md"),
      "utf8",
    );
    const description = source.match(/^description:\s*(.+)$/m)?.[1] ?? "";

    assert.match(description, /Polyglot software engineering agent/);
    assert.ok(!description.includes("→"), "description must not encode workflow arrows");
    assert.ok(!/\b(first|then|step\s*\d)\b/i.test(description), "description must not encode steps");
  });

  it("is selected for a refactor/maintainability prompt", () => {
    const taskRoot = mkdtempSync(join(tmpdir(), "wam-craftsman-"));
    mkdirSync(join(taskRoot, ".wam"), { recursive: true });
    const { registry } = buildRealRegistry();

    const result = routeSkillsV2(
      "implement this service and refactor the model following software design principles",
      {},
      registry,
      "STANDARD",
      { minSkillScore: 0, projectRoot: taskRoot },
    );

    const ids = result.selected.map((s) => s.id ?? s.name);
    assert.ok(ids.includes(SKILL_ID), `expected ${SKILL_ID} in ${ids.join(", ")}`);
    const selected = result.selected.find((s) => (s.id ?? s.name) === SKILL_ID);
    assert.strictEqual(selected.base, true, "craftsman must load as base");
  });

  it("injects the Craftsman Ladder body instead of headings only", async () => {
    const projectPath = mkdtempSync(join(tmpdir(), "wam-craftsman-inject-"));
    mkdirSync(join(projectPath, ".wam"), { recursive: true });
    try {
      const { registry } = buildRealRegistry();
      const pack = await assembleContext({
        prompt:
          "implement this service and refactor the model following software design principles",
        taskId: "t-craftsman-inject",
        classification: "normal",
        mode: "NORMAL",
        budget: 32000,
        projectPath,
        skillRegistry: registry,
        selectedSkills: [
          {
            id: SKILL_ID,
            reason:
              "score 58 (trigger:implement,trigger:refactor,trigger:software design,trigger:model)",
            relevance: 58,
            base: false,
          },
        ],
      });

      const injected = pack.lines.find((line) =>
        line.includes(`[wam N3 skill] ${SKILL_ID}`),
      );
      assert.ok(injected, "craftsman skill must be injected");
      assert.ok(injected.includes("Craftsman Ladder"), "ladder heading must be injected");
      assert.ok(injected.includes("RUNG-1"), "first rung must be injected");
      assert.ok(injected.includes("EVALUATE"), "rung body must be injected");
      assert.ok(injected.includes("## 5. Output"), "the full skill body must be injected");
      const state = pack.skillStates.find((item) => item.id === SKILL_ID);
      assert.strictEqual(state.truncated, false, "craftsman must not be truncated");
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
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

  it("documents the full engineering protocol", () => {
    const { registry } = buildRealRegistry();
    const entry = registry[SKILL_ID];
    for (const marker of ["## 1. Engineering Invariants", "INV-05", "## 2. Craftsman Ladder", "RUNG-5", "## 3. Implementation Directives", "## AI Metadata", "## 4. Diff Audit", "## 5. Output Contract"]) {
      assert.ok(entry.content.includes(marker), `missing section: ${marker}`);
    }
  });
});
