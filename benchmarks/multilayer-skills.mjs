
// Multi-layer skill-injection benchmark (FE + BE + DB).
//
// Runs the real WAM pipeline on a cross-layer prompt: discoverSkills ->
// buildRegistry -> routeSkillsV2 (via analyze) -> assembleContext. It reports
// which skills are selected, which bodies are actually injected into the
// assembled context, and how the injected cost compares to loading the whole
// catalog. Deterministic and network-free.
//
// Usage: node benchmarks/multilayer-skills.mjs
import fs from "node:fs";
import path from "node:path";
import { analyze } from "../src/skills/engine.js";
import { assembleContext } from "../src/context/assembly.js";

const REPO = path.resolve(import.meta.dirname, "..");
const PROMPT = [
  "Implement a full-stack feature spanning three layers:",
  "1) Frontend (Angular 20): an invoice-list component using signals and a service calling the API.",
  "2) Backend (NestJS + TypeORM): a controller and service exposing GET /invoices and POST /invoices with DTO validation.",
  "3) Database: a TypeORM migration creating the invoices table with indices.",
  "Then write unit tests, run them, and verify completion with evidence.",
  "Delegate frontend to @frontend-exec, backend to @backend-exec, DB migration to @backend-exec.",
].join("\n");

const est = (t) => Math.ceil(String(t || "").length / 4);

const analysis = await analyze({ prompt: PROMPT, projectPath: REPO });
const selected = (analysis.skills && analysis.skills.selected) || [];
const registry = analysis.skillRegistryMap || {};

const pack = assembleContext({
  prompt: PROMPT,
  taskId: "multilayer-bench",
  classification: analysis.intent?.classification,
  mode: analysis.strategy,
  projectPath: REPO,
  budget: 4000,
  skillRegistry: registry,
  selectedSkills: selected,
});
const packed = (pack.lines || []).join("\n");

const skills = selected.map((s) => {
  const id = s.id || s.name;
  const entry = registry[id];
  const content = entry ? entry.content || entry.body || "" : "";
  return {
    id,
    base: Boolean(s.base),
    relevance: s.relevance ?? null,
    reason: s.reason || null,
    skill_tokens: est(content),
    injected: packed.includes(`[wam N3 skill] ${id}`),
  };
});

const catalogTokens = Object.values(registry).reduce((a, e) => a + est(e.content || e.body || ""), 0);
const report = {
  prompt: PROMPT,
  classification: analysis.intent?.classification,
  strategy: analysis.strategy,
  registry_size: Object.keys(registry).length,
  selected: skills,
  budget: pack.budget,
  budget_used: pack.budget_used,
  rationale: pack.rationale || [],
  tokens: {
    whole_catalog_if_loaded: catalogTokens,
    selected_bodies: skills.reduce((a, s) => a + s.skill_tokens, 0),
    wam_injected: est(packed),
  },
};
const dir = path.join(REPO, "benchmarks", "results");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `multilayer-skills-${Date.now()}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2));

console.log(`multi-layer benchmark -> ${file}`);
console.log(`registry=${report.registry_size} selected=${skills.length} injected=${skills.filter((s) => s.injected).length}`);
console.log(`tokens: whole_catalog=${catalogTokens} selected_bodies=${report.tokens.selected_bodies} injected=${report.tokens.wam_injected} (budget ${pack.budget_used}/${pack.budget})`);
for (const s of skills) console.log(`  ${s.injected ? "INJ" : "-- "} ${s.id} ${s.base ? "[base]" : `[match ${s.relevance}]`} ${s.skill_tokens}tok`);
