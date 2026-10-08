import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSkillsV2, buildRegistry } from "../../src/skills/engine.js";
import { assembleContext } from "../../src/context/assembly.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";
import {
  injectWamParts,
  tagWamPart,
  isWamSynthetic,
} from "../../src/integration/part-provenance.js";

// Load the real bundled catalog exactly as the plugin's loadBundledRegistry()
// does (index.js): skills/registry.json -> { [id]: skill }. This is the same
// surface getRegistry() exposes to the pre-flight skill router.
function loadBundledRegistry() {
  const registryPath = path.join(process.cwd(), "skills", "registry.json");
  const entries = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  const registry = {};
  for (const skill of entries) registry[skill.id] = skill;
  return registry;
}

const REGISTRY = loadBundledRegistry();

function select(prompt) {
  return routeSkillsV2(prompt, {}, REGISTRY, "STANDARD");
}

function assembleWithSkills(prompt, selected, overrides = {}) {
  return assembleContext({
    prompt,
    skillRegistry: REGISTRY,
    selectedSkills: selected,
    budget: 8000,
    classification: "normal",
    ...overrides,
  });
}

// Normal scenarios verified against the real catalog: a domain prompt must
// detect a capability, select the matching skill(s), and inject real content.
const SCENARIOS = [
  { prompt: "implement tdd workflow", expect: ["antigravity-awesome-skills-tdd", "antigravity-awesome-skills-implement"] },
  { prompt: "write documentation", expect: ["antigravity-awesome-skills-documentation"] },
  { prompt: "angular component", expect: ["antigravity-awesome-skills-angular"] },
];

describe("skill pipeline integration (detect -> select -> inject)", () => {
  it("loads the real bundled catalog with embedded content", () => {
    const ids = Object.keys(REGISTRY);
    assert.ok(ids.length > 1000, `expected a large catalog, got ${ids.length}`);
    for (const { expect } of SCENARIOS) {
      for (const skill of expect) {
        assert.ok(REGISTRY[skill], `${skill} must exist in the catalog`);
        assert.ok(
          REGISTRY[skill].content && REGISTRY[skill].content.trim().length > 0,
          `${skill} must carry embedded content`
        );
      }
    }
  });

  for (const { prompt, expect } of SCENARIOS) {
    it(`DETECTS and SELECTS the right skill(s) for: "${prompt}"`, () => {
      const result = select(prompt);
      const ids = result.selected.map((s) => s.id);
      for (const skill of expect) {
        assert.ok(ids.includes(skill), `expected ${skill} in selected [${ids.join(", ")}]`);
        const picked = result.selected.find((s) => s.id === skill);
        assert.ok(picked.reason && picked.reason.length > 0, `${skill} selection must be explainable (reason)`);
        assert.ok((picked.relevance ?? 0) > 0, `${skill} must score above zero`);
      }
      assert.ok(Array.isArray(result.rejected), "routing result must report rejected candidates");
    });
  }

  for (const { prompt, expect } of SCENARIOS) {
    it(`INJECTS the real content of "${expect[0]}" into the assembled context`, () => {
      const result = select(prompt);
      const pack = assembleWithSkills(prompt, result.selected);
      const text = pack.lines.join("\n");
      const marker = `[wam N3 skill] ${expect[0]}`;
      assert.ok(text.includes(marker), `expected injected marker "${marker}"`);

      // Prove it is the REAL catalog content, not a placeholder.
      const snippet = REGISTRY[expect[0]].content.replace(/\s+/g, " ").trim().slice(0, 24);
      assert.ok(snippet.length > 0, "catalog content must be non-empty");
      assert.ok(
        text.replace(/\s+/g, " ").includes(snippet),
        `injected content must contain real skill text: "${snippet}"`
      );
      assert.ok(
        pack.rationale.some((r) => r.includes(`N3: ${expect[0]} inyectada`) || r.includes(expect[0])),
        `rationale must account for the injected skill ${expect[0]}`
      );
    });
  }

  it("does NOT inject skill content for a trivial classification", () => {
    const { prompt, expect } = SCENARIOS[0];
    const result = select(prompt);
    const pack = assembleWithSkills(prompt, result.selected, { classification: "trivial" });
    assert.ok(!pack.lines.join("\n").includes(`[wam N3 skill] ${expect[0]}`));
  });

  it("wraps the injected skill context as a synthetic WAM part (injectWamParts)", () => {
    const { prompt, expect } = SCENARIOS[0];
    const result = select(prompt);
    const pack = assembleWithSkills(prompt, result.selected);
    const skillLines = pack.lines.filter((l) => l.includes("[wam N3 skill]"));
    assert.ok(skillLines.length > 0, "there must be skill lines to inject");
    const skillText = skillLines.join("\n");
    assert.ok(skillText.includes(expect[0]));

    const output = { parts: [] };
    injectWamParts(output, [skillText], {
      messageID: "msg-skill-1",
      phase: "emit",
      idFactory: () => "wam-skill-part-1",
      position: "prepend",
    });

    assert.equal(output.parts.length, 1);
    const part = output.parts[0];
    assert.ok(isWamSynthetic(part), "injected part must be tagged as WAM synthetic");
    assert.equal(part.type, "text");
    assert.equal(part.id, "wam-skill-part-1");
    assert.equal(part.metadata.wamMessageId, "msg-skill-1");
    assert.ok(part.text.includes(expect[0]), "injected part must carry the skill content");
  });

  it("tagWamPart marks provenance without mutating the source part", () => {
    const source = { type: "text", text: "hello" };
    const tagged = tagWamPart(source, { messageID: "m", phase: "emit" });
    assert.equal(source.synthetic, undefined);
    assert.equal(tagged.synthetic, true);
    assert.equal(tagged.metadata.wam, true);
    assert.equal(tagged.metadata.wamMessageId, "m");
    assert.ok(isWamSynthetic(tagged));
  });
});

describe("local skill content embedding (fail-open registry)", () => {
  const LOCAL = buildRegistry(discoverSkills({ root: process.cwd() }), process.cwd()).registry;

  it("embeds SKILL.md content for local skills instead of metadata-only entries", () => {
    const locals = Object.values(LOCAL).filter((s) => s.source?.kind === "local");
    assert.ok(locals.length > 0, "expected discovered local skills");
    const withContent = locals.filter((s) => typeof s.content === "string" && s.content.trim().length > 0);
    assert.ok(withContent.length > 0, "local skills must carry embedded content");
    assert.ok(!withContent[0].content.startsWith("---"), "YAML frontmatter must be stripped");
  });

  it("injects a selected LOCAL skill's content into the assembled context", () => {
    const prompt = "create a nestjs module and guard endpoint";
    const result = routeSkillsV2(prompt, {}, LOCAL, "STANDARD");
    const ids = result.selected.map((s) => s.id);
    assert.ok(ids.includes("nestjs-developer"), `expected nestjs-developer in [${ids.join(", ")}]`);
    const pack = assembleContext({
      prompt,
      skillRegistry: LOCAL,
      selectedSkills: result.selected,
      budget: 8000,
      classification: "normal",
    });
    assert.ok(pack.lines.join("\n").includes("[wam N3 skill] nestjs-developer"), "local skill content must be injected");
  });
});
