
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { routeSkillsV2 } from "../../src/skills/engine.js";
import { assembleContext } from "../../src/context/assembly.js";

function loadBundledRegistry() {
  const p = path.join(process.cwd(), "skills", "registry.json");
  const entries = JSON.parse(fs.readFileSync(p, "utf-8"));
  const reg = {};
  for (const skill of entries) reg[skill.id] = skill;
  return reg;
}
const REGISTRY = loadBundledRegistry();
const est = (t) => Math.ceil(String(t || "").length / 4);

const PROMPT =
  "Implement a REST API from an OpenAPI spec, write an Oracle-to-Postgres migration plan, " +
  "and generate Playwright tests for the endpoints.";

test("multi-layer prompt selects multiple matched skills and injects their real content", () => {
  const routing = routeSkillsV2(PROMPT, {}, REGISTRY, "STRICT");
  const selected = routing.selected || [];
  assert.ok(selected.length >= 2, `expected multiple selected skills, got ${selected.length}`);
  const matched = selected.filter((s) => !s.base);
  assert.ok(matched.length >= 2, `expected several task-matched skills, got ${matched.length}`);
  for (const s of matched) assert.ok(s.reason, `${s.id} must be explainable`);

  const pack = assembleContext({
    prompt: PROMPT,
    taskId: "multilayer-test",
    classification: "architectural",
    mode: "STRICT",
    projectPath: process.cwd(),
    budget: 8000,
    skillRegistry: REGISTRY,
    selectedSkills: selected,
  });
  const text = pack.lines.join("\n");
  const withContent = selected.filter((s) => String(REGISTRY[s.id]?.content || "").trim().length > 0);
  const injected = withContent.filter((s) => text.includes(`[wam N3 skill] ${s.id}`));
  assert.ok(injected.length >= 2, `expected >=2 injected skills, got ${injected.length}`);
  assert.equal(
    injected.length,
    withContent.length,
    `all selected skills with content must inject within budget: injected [${injected.map((s) => s.id)}] vs [${withContent.map((s) => s.id)}]`
  );

  const catalogTokens = Object.values(REGISTRY).reduce((a, s) => a + est(s.content || ""), 0);
  assert.ok(est(text) < catalogTokens, "injected context must be far smaller than loading the whole catalog");
});
