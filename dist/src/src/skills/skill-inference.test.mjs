import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { routeSkillsV2, loadSkillOnDemand, buildRegistry } from "./engine.js";
import { discoverSkills, getSkillSearchPaths } from "../policy/skill-routing.js";

// ---------------------------------------------------------------------------
// Deterministic fixture: a synthetic registry, no bundled corpus, no network,
// no LLM. Scoring must be a pure function of (prompt, registry, weights).
//
// API real verificada contra el source:
//   routeSkillsV2(prompt, projectInfo, registry, mode, options)  mode in {FAST, STANDARD, STRICT}
//   rigor = options.rigor || (FAST->MINIMAL, STRICT->RIGOROUS, else STANDARD)
//   limit = MINIMAL->0, RIGOROUS->5, STANDARD->3
//   selected = [...baseSkills, ...candidates.slice(0, limit)]
//   buildRegistry(...) -> { registry, corpusRoot, sources, registryFile }
// ---------------------------------------------------------------------------

function makeRegistry(specs) {
  const registry = {};
  for (const s of specs) {
    registry[s.id] = {
      id: s.id,
      name: s.name || s.id,
      description: s.description || "",
      capabilities: s.capabilities || [],
      keywords: s.keywords || [],
      domain: s.domain || [],
      risk: s.risk || "low",
      status: s.status || "APPROVED",
      loadStrategy: s.loadStrategy || "ondemand",
      content: s.content ?? "",
      source: { kind: "local", id: "test" },
    };
  }
  return registry;
}

const SKILL_TYPES = [
  { id: "angular-developer", capabilities: ["frontend", "angular", "component"], keywords: ["angular", "componente", "signal"], prompt: "crear un componente angular con signals reactivos" },
  { id: "nestjs-developer", capabilities: ["backend", "nestjs", "api"], keywords: ["nestjs", "guard", "module", "endpoint"], prompt: "crear un modulo nestjs con guards y endpoint" },
  { id: "ui-ux-design-pro", capabilities: ["frontend", "ui", "design"], keywords: ["dashboard", "tailwind", "diseno"], prompt: "disenar un dashboard con tailwind" },
  { id: "backend-integrity", capabilities: ["backend", "transactions", "data"], keywords: ["transaccion", "base de datos"], prompt: "asegurar transacciones en base de datos" },
  { id: "architectural-governance", capabilities: ["architecture", "coherence"], keywords: ["arquitectura", "drift"], prompt: "revisar coherencia de arquitectura y drift" },
  { id: "fixing-accessibility", capabilities: ["frontend", "a11y", "accessibility"], keywords: ["aria", "wcag"], prompt: "auditar accesibilidad aria y wcag" },
];

function selectedIds(result) {
  return result.selected.map((s) => s.id);
}

test("infiere la skill correcta para cada tipo (top-1 determinista)", () => {
  const registry = makeRegistry(SKILL_TYPES);
  for (const type of SKILL_TYPES) {
    const result = routeSkillsV2(type.prompt, {}, registry, "STANDARD", {});
    const ids = selectedIds(result);
    assert.ok(ids.includes(type.id), `prompt "${type.prompt}" debe inferir ${type.id}; obtuvo [${ids.join(", ")}]`);
    assert.equal(result.selected[0]?.id, type.id, `prompt "${type.prompt}" debe tener ${type.id} como top-1; obtuvo "${result.selected[0]?.id}"`);
  }
});

test("la inferencia es determinista: mismo input => mismo output", () => {
  const registry = makeRegistry(SKILL_TYPES);
  const prompt = "crear un componente angular con signals reactivos";
  const first = selectedIds(routeSkillsV2(prompt, {}, registry, "STANDARD", {})).join(",");
  for (let i = 0; i < 5; i++) {
    const again = selectedIds(routeSkillsV2(prompt, {}, registry, "STANDARD", {})).join(",");
    assert.equal(again, first, `run #${i} divergio: "${again}" !== "${first}"`);
  }
});

test("el orden de seleccion respeta el score descendente (determinista)", () => {
  const registry = makeRegistry(SKILL_TYPES);
  const result = routeSkillsV2("revisar coherencia de arquitectura y drift", {}, registry, "STANDARD", {});
  const relevances = result.selected.map((s) => s.relevance);
  for (let i = 1; i < relevances.length; i++) {
    assert.ok(relevances[i - 1] >= relevances[i], `orden no determinista por score: ${relevances.join(", ")}`);
  }
  assert.ok(result.counts.selected <= result.counts.limit || result.counts.limit === 0);
});

test("no infiere skills para un prompt sin coincidencias", () => {
  const registry = makeRegistry(SKILL_TYPES);
  const result = routeSkillsV2("xyzqwerty zzz plop", {}, registry, "STANDARD", {});
  assert.equal(result.selected.length, 0, "no debe seleccionar skills sin match");
  assert.equal(result.candidates.length, 0);
});

test("MINIMAL no incluye skills on-demand; RIGOROUS amplia el limite a 5", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ id: `skill-${i}`, capabilities: ["alpha", "beta"], keywords: ["gamma"] }));
  const registry = makeRegistry(many);
  const prompt = "alpha beta gamma";

  // mode FAST -> rigor MINIMAL -> limit 0 -> solo base skills (aqui: ninguna)
  const minimal = routeSkillsV2(prompt, {}, registry, "FAST", {});
  assert.equal(minimal.counts.limit, 0);
  assert.equal(minimal.selected.filter((s) => !s.base).length, 0, "MINIMAL no debe incluir skills on-demand");

  // mode STANDARD -> rigor STANDARD -> limit 3
  const standard = routeSkillsV2(prompt, {}, registry, "STANDARD", {});
  assert.equal(standard.counts.limit, 3);
  assert.equal(standard.selected.length, 3);

  // mode STRICT -> rigor RIGOROUS -> limit 5
  const rigorous = routeSkillsV2(prompt, {}, registry, "STRICT", {});
  assert.equal(rigorous.counts.limit, 5);
  assert.equal(rigorous.selected.length, 5);

  // los modos son subconjuntos estrictamente crecientes
  assert.ok(rigorous.selected.length > standard.selected.length);
  assert.ok(standard.selected.length > minimal.selected.length);
});

test("loadSkillOnDemand materializa SKILL.md solo para skills aprobadas", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-skill-"));
  try {
    const registry = makeRegistry([
      { id: "angular-developer", content: "# Angular skill\nDo Angular things." },
      { id: "rejected-x", content: "# x", status: "REJECTED" },
      { id: "empty-x", content: "" },
    ]);
    const ok = loadSkillOnDemand("angular-developer", registry, tmp);
    assert.equal(ok.loaded, true);
    assert.equal(ok.skillId, "angular-developer");
    assert.ok(fs.existsSync(ok.contentPath), "SKILL.md debe existir en disco");
    assert.match(fs.readFileSync(ok.contentPath, "utf-8"), /Angular skill/);
    assert.equal(loadSkillOnDemand("rejected-x", registry, tmp).loaded, false);
    assert.equal(loadSkillOnDemand("empty-x", registry, tmp).loaded, false);
    assert.equal(loadSkillOnDemand("does-not-exist", registry, tmp).loaded, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("discoverSkills resuelve skills instaladas on-demand con tiers validos", () => {
  const found = discoverSkills({ root: process.cwd(), home: os.homedir() });
  const entries = Object.entries(found);
  assert.ok(entries.length > 0, "debe descubrir al menos una skill instalada");
  const validTiers = new Set(["project-local", "user-global", "bundled"]);
  for (const [name, meta] of entries) {
    assert.equal(meta.name, name, "la clave debe coincidir con meta.name");
    assert.ok(meta.path.endsWith("SKILL.md"), `${name}: path debe apuntar a SKILL.md`);
    assert.ok(validTiers.has(meta.tier), `${name}: tier invalido "${meta.tier}"`);
  }
});

test("getSkillSearchPaths garantiza precedencia determinista por tier", () => {
  const dirs = getSkillSearchPaths({ root: "/repo", home: "/home/u" });
  const tiers = dirs.map((d) => d.tier);
  const firstUserGlobal = tiers.indexOf("user-global");
  const lastProjectLocal = tiers.lastIndexOf("project-local");
  const firstBundled = tiers.indexOf("bundled");
  assert.ok(lastProjectLocal < firstUserGlobal, "project-local precede a user-global");
  assert.ok(firstUserGlobal < firstBundled, "user-global precede a bundled");
});

test("integracion: discoverSkills -> buildRegistry -> inferencia on-demand", () => {
  const found = discoverSkills({ root: process.cwd(), home: os.homedir() });
  const available = {};
  for (const [name, meta] of Object.entries(found)) available[name] = { path: meta.path };
  const { registry } = buildRegistry(available, process.cwd());
  const installed = Object.keys(available).filter((id) => registry[id]);
  assert.ok(installed.length > 0, "al menos una skill descubierta debe entrar al registry");
  for (const id of installed) {
    assert.equal(registry[id].status, "APPROVED", `skill instalada ${id} debe quedar APPROVED en el registry`);
  }
  const result = routeSkillsV2("crear un componente angular", {}, registry, "STANDARD", {});
  assert.ok(result.selected.length > 0, "debe seleccionar al menos una skill del registry real");
  for (const s of result.selected) {
    assert.ok(registry[s.id], `skill inferida ${s.id} debe existir en el registry`);
    if (s.base) assert.equal(s.relevance, 0, `skill base ${s.id} tiene relevancia 0`);
    else assert.ok(s.relevance > 0, `skill on-demand ${s.id} debe tener relevancia > 0`);
  }
});
