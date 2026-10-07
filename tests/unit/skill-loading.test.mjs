import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeSkillsV2 } from "../../src/skills/engine.js";

const registry = {
  "codebase-design": {
    id: "codebase-design",
    name: "codebase-design",
    description: "Deep modules",
    capabilities: ["architecture", "deep-module"],
    triggers: ["deep module", "arquitectura"],
    risk: "low",
    loadStrategy: "base",
    compatibility: { opencode: true },
    status: "APPROVED",
    cache: false,
    source: { kind: "local", path: "skills/codebase-design/SKILL.md", ref: "installed" },
  },
  "writing-for-agents": {
    id: "writing-for-agents",
    name: "writing-for-agents",
    description: "Meta-skill",
    capabilities: ["context", "prompt", "agent"],
    triggers: ["escribir", "AGENTS.md"],
    risk: "low",
    loadStrategy: "base",
    compatibility: { opencode: true },
    status: "APPROVED",
    cache: false,
    source: { kind: "local", path: "skills/writing-for-agents/SKILL.md", ref: "installed" },
  },
};

describe("skill-loading-base", () => {
  it("base skills always selected regardless of prompt", () => {
    const result = routeSkillsV2("help me debug", {}, registry, "STANDARD");
    const names = result.selected.map(s => s.name).sort();
    assert.ok(names.includes("codebase-design"), "codebase-design base skill should be selected");
    assert.ok(names.includes("writing-for-agents"), "writing-for-agents base skill should be selected");
  });

  it("base skills appear even with empty prompt", () => {
    const result = routeSkillsV2("", {}, registry, "STANDARD");
    const names = result.selected.map(s => s.name).sort();
    assert.strictEqual(names.length, 2, "should select exactly 2 base skills");
    assert.ok(names.includes("codebase-design"));
    assert.ok(names.includes("writing-for-agents"));
  });

  it("routeSkillsV2 returns base flag per skill", () => {
    const result = routeSkillsV2("test prompt", {}, registry, "STANDARD");
    const selectedBase = result.selected.filter(s => s.base === true).map(s => s.name);
    const selectedNonBase = result.selected.filter(s => s.base !== true).map(s => s.name);
    assert.strictEqual(selectedBase.length, 2, "2 base skills always selected");
    assert.strictEqual(selectedNonBase.length, 0, "no on-demand skills without prompt match");
  });
});
