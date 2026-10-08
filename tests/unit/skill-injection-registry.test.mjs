import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { analyze } from "../../src/skills/engine.js";
import { discoverSkills, getSkillSearchPaths } from "../../src/policy/skill-routing.js";

// Regression: the injection layer must resolve skill content from the SAME
// unified registry that produced the selection (base skills + local + bundled),
// and the singular user-global dir (~/.config/opencode/skill) must be scanned.

test("getSkillSearchPaths incluye los dirs singulares skill/", () => {
  const dirs = getSkillSearchPaths({ root: "/repo", home: "/home/u" }).map((d) => d.dir);
  assert.ok(dirs.includes("/home/u/.config/opencode/skill"), "falta ~/.config/opencode/skill");
  assert.ok(dirs.includes("/repo/.opencode/skill"), "falta .opencode/skill");
});

test("discoverSkills escanea ~/.config/opencode/skill (hermetico)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-skill-home-"));
  try {
    const dir = path.join(tmp, ".config", "opencode", "skill", "my-skill");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), "# my-skill\ncontenido");
    const found = discoverSkills({ root: path.join(tmp, "norepo"), home: tmp });
    assert.ok(found["my-skill"], "debe descubrir skills en el dir singular");
    assert.equal(found["my-skill"].tier, "user-global");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("analyze expone skillRegistryMap y toda skill seleccionada resuelve contenido", async () => {
  const a = await analyze({ prompt: "review accessibility aria wcag", projectPath: process.cwd() });
  assert.ok(a.skillRegistryMap && typeof a.skillRegistryMap === "object", "skillRegistryMap ausente");
  const selected = a.skills?.selected || [];
  assert.ok(selected.length > 0, "debe seleccionar al menos las skills base");
  for (const s of selected) {
    const entry = a.skillRegistryMap[s.id];
    assert.ok(entry, "skill seleccionada " + s.id + " no esta en skillRegistryMap");
    assert.ok((entry.content || "").length > 0, s.id + " sin contenido embebido");
  }
});

test("skills base se seleccionan siempre y resuelven contenido", async () => {
  const a = await analyze({ prompt: "escribir una skill sobre AGENTS.md", projectPath: process.cwd() });
  const base = (a.skills?.selected || []).filter((s) => s.base).map((s) => s.id).sort();
  // El set base minimo garantizado: los dos skills builtin locales.
  assert.ok(base.includes("codebase-design"), "codebase-design debe estar en base");
  assert.ok(base.includes("writing-for-agents"), "writing-for-agents debe estar en base");
  // Cualquier base externa adicional (p.ej. ponytail via loadStrategy:"base") debe
  // tener contenido embebido no-vacio.
  for (const id of base) {
    assert.ok((a.skillRegistryMap[id]?.content || "").length > 0, id + " base sin contenido inyectable");
  }
  // Si el catalogo curado declara ponytail como base, debe aparecer aqui.
  const id = "dietrichgebert-ponytail-ponytail";
  if (a.skillRegistryMap[id] && a.skillRegistryMap[id].loadStrategy === "base") {
    assert.ok(base.includes(id), "ponytail-base debe estar seleccionada si esta en el catalogo");
  }
});
