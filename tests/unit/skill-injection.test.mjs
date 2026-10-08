import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRegistry, routeSkillsV2 } from "../../src/skills/engine.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";

const MATTPOCOCK_SKILLS = [
  "writing-for-agents",
  "codebase-design",
  "diagnosing-bugs",
  "tdd",
  "handoff",
  "wizard",
  "prototype",
  "improve-codebase-architecture",
];

// Base set includes the two local builtins (writing-for-agents, codebase-design)
// PLUS any curated source skill flagged loadStrategy:"base" in registry.json
// (e.g. dietrichgebert-ponytail-ponytail). Tests dynamically resolve the
// real base set from the merged registry as {id, name} pairs so they can be
// looked up in both shapes (registry is keyed by id; selectedNames returns
// name).
function resolveBaseSkills() {
  const { registry } = buildRealRegistry();
  return Object.entries(registry)
    .filter(([, s]) => s && s.loadStrategy === "base")
    .map(([id, s]) => ({ id, name: s.name || id }));
}
const BASE_SKILLS = resolveBaseSkills();
const BASE_SKILL_IDS = new Set(BASE_SKILLS.map((b) => b.id));
const BASE_SKILL_NAMES = new Set(BASE_SKILLS.map((b) => b.name));
const MATT_BASE_NAMES = MATTPOCOCK_SKILLS.filter((s) => BASE_SKILL_NAMES.has(s));
const ONDEMAND_SKILLS = MATTPOCOCK_SKILLS.filter((s) => !BASE_SKILL_NAMES.has(s));

// Builds the registry exactly as the plugin does in the real preflight flow:
// discovered local skills + injected builtin routing metadata.
function buildRealRegistry() {
  const availableSkills = discoverSkills({ root: process.cwd() });
  const { registry } = buildRegistry(availableSkills, process.cwd());
  return { registry, availableSkills };
}

function selectedNames(result) {
  return result.selected.map((s) => s.name);
}

describe("skill-injection", () => {
  it("discovers every vendored mattpocock skill in the file system", () => {
    const available = discoverSkills({ root: process.cwd() });
    for (const name of MATTPOCOCK_SKILLS) {
      assert.ok(available[name], `${name} should be discovered`);
      assert.ok(available[name].path.endsWith(`${name}/SKILL.md`), `${name} should resolve to its SKILL.md`);
    }
  });

  it("injects mattpocock skills into the registry as APPROVED with correct loadStrategy", () => {
    const { registry } = buildRealRegistry();

    for (const name of MATTPOCOCK_SKILLS) {
      assert.ok(registry[name], `${name} should be in the registry`);
      assert.strictEqual(registry[name].status, "APPROVED", `${name} should be APPROVED`);
      assert.strictEqual(registry[name].source.kind, "local", `${name} should be a local source`);
    }

    // Bases — usar id como clave del registry (puede diferir del nombre para
    // entries curados externos).
    for (const { id, name } of BASE_SKILLS) {
      assert.ok(registry[id], `${name} (${id}) debe estar en el registry`);
      assert.strictEqual(registry[id].loadStrategy, "base", `${name} should load as base`);
    }
    for (const name of ONDEMAND_SKILLS) {
      assert.strictEqual(registry[name].loadStrategy, "ondemand", `${name} should load on demand`);
    }
  });

  it("always injects base skills regardless of the prompt", () => {
    const { registry } = buildRealRegistry();

    for (const prompt of ["", "asdf qwerty zxcv", "totally unrelated request about cooking"]) {
      const result = routeSkillsV2(prompt, {}, registry, "STANDARD");
      const names = selectedNames(result);

      // Solo nos importan las bases que estan en el registry actual (locales).
      for (const { name } of BASE_SKILLS) {
        assert.ok(names.includes(name), `${name} should be injected for prompt "${prompt}"`);
      }
      assert.strictEqual(result.counts.base, BASE_SKILLS.length, "base count should match");

      for (const skill of result.selected.filter((s) => BASE_SKILLS.includes(s.name))) {
        assert.strictEqual(skill.base, true, `${skill.name} should be flagged base`);
        assert.strictEqual(skill.relevance, 0, `${skill.name} base relevance should be 0 (bypasses scoring)`);
      }
    }
  });

  it("injects on-demand skills when their capability matches the prompt", () => {
    const { registry } = buildRealRegistry();

    const cases = [
      { prompt: "debug this broken service", skill: "diagnosing-bugs" },
      { prompt: "write tdd integration test", skill: "tdd" },
      { prompt: "handoff the context to the next agent", skill: "handoff" },
      { prompt: "setup credentials for the deploy", skill: "wizard" },
      { prompt: "prototype the state model", skill: "prototype" },
      { prompt: "deepening scan of the architecture", skill: "improve-codebase-architecture" },
    ];

    for (const { prompt, skill } of cases) {
      const result = routeSkillsV2(prompt, {}, registry, "RIGOROUS");
      const names = selectedNames(result);

      assert.ok(names.includes(skill), `${skill} should be injected for prompt "${prompt}" (got ${names})`);
      for (const { name: base } of BASE_SKILLS) {
        assert.ok(names.includes(base), `${base} base skill should still be injected for prompt "${prompt}"`);
      }

      const injected = result.selected.find((s) => s.name === skill);
      assert.strictEqual(injected.base, false, `${skill} should not be flagged base`);
      assert.ok(injected.relevance > 0, `${skill} should carry a positive relevance score`);
    }
  });

  it("does not inject on-demand skills when nothing matches", () => {
    const { registry } = buildRealRegistry();
    const result = routeSkillsV2("hello world", {}, registry, "STANDARD");

    for (const name of ONDEMAND_SKILLS) {
      assert.ok(!selectedNames(result).includes(name), `${name} should not be injected without a match`);
    }
    // Solo contar bases presentes en este registry (locales).
    assert.strictEqual(result.counts.base, BASE_SKILLS.length);
  });

  it("honors explicit metadata injected at build time over builtins", () => {
    const available = {
      "writing-for-agents": {
        name: "writing-for-agents",
        path: "skills/writing-for-agents/SKILL.md",
        metadata: { capabilities: ["custom-cap"], triggers: ["custom"], risk: "low", loadStrategy: "ondemand" },
      },
    };
    const { registry } = buildRegistry(available, process.cwd());

    assert.strictEqual(registry["writing-for-agents"].loadStrategy, "ondemand", "injected metadata should win");
    assert.deepStrictEqual(registry["writing-for-agents"].capabilities, ["custom-cap"]);

    const result = routeSkillsV2("hello world", {}, registry, "STANDARD");
    assert.ok(!selectedNames(result).includes("writing-for-agents"), "ondemand skill without match should not load");
  });

  it("never counts rejected (non-approved) skills as injected", () => {
    const available = {
      "writing-for-agents": {
        name: "writing-for-agents",
        path: "skills/writing-for-agents/SKILL.md",
        metadata: { capabilities: ["context"], triggers: ["context"], risk: "low", loadStrategy: "base" },
        status: "PENDING",
      },
    };
    const { registry } = buildRegistry(available, process.cwd());
    registry["writing-for-agents"].status = "PENDING";

    const result = routeSkillsV2("context", {}, registry, "STANDARD");
    assert.ok(!selectedNames(result).includes("writing-for-agents"), "pending skill must not be injected");
    assert.ok(result.rejected.includes("writing-for-agents"), "pending skill should be reported as rejected");
  });
});