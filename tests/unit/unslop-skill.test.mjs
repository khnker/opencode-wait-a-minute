import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getRoleDefinition } from "../../src/agents/role-contracts.js";
import { resolveRoleSkills } from "../../src/agents/role-skills.js";
import { discoverSkills } from "../../src/policy/skill-routing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKILL_DIR = path.join(ROOT, "skills", "unslop");

test("unslop is vendored with attribution and its references", () => {
  const skill = fs.readFileSync(path.join(SKILL_DIR, "SKILL.md"), "utf8");
  assert.match(skill, /^# Unslop/);
  assert.match(skill, /CC BY 4\.0/);

  const required = [
    "NOTICE.md",
    "LICENSE",
    "references/upstream-skill.md",
    "references/signs.md",
    "references/visuals.md",
    "references/tokens.md",
    "references/effects.md",
    "references/refs.md",
    "scripts/snapshot.mjs",
    "scripts/story.mjs",
    "agents/openai.yaml",
  ];
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(SKILL_DIR, rel)), `missing ${rel}`);
  }
});

test("unslop is discovered as a bundled skill", () => {
  const candidates = discoverSkills({ root: ROOT });
  assert.ok(candidates.unslop, "unslop discovered");
  assert.equal(
    path.resolve(candidates.unslop.path),
    path.join(SKILL_DIR, "SKILL.md")
  );
});

test("unslop is a base skill for frontend and UX roles", () => {
  for (const role of ["FRONTEND_ENGINEER", "UX_DESIGNER"]) {
    assert.ok(
      getRoleDefinition(role).skills.includes("unslop"),
      `${role} declares unslop`
    );
    const loaded = resolveRoleSkills(role, { root: ROOT });
    assert.ok(loaded.skills.includes("unslop"), `${role} injects unslop`);
  }
});
