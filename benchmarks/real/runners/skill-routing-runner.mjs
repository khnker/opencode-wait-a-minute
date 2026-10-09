/**
 * Skill-routing accuracy runner.
 *
 * Drives the real WAM pipeline (analyze -> discoverSkills -> buildRegistry ->
 * routeSkillsV2) over the corpus and computes routing precision/recall.
 *
 * Deterministic and network-free.
 */

import { analyze } from "../../../src/skills/engine.js";
import { SKILL_ROUTING_CORPUS, BASE_SKILL_IDS } from "../../scenarios/skill-routing.mjs";

/**
 * Evaluate a single corpus case against the actual selected skills.
 * @param {object} caseDef
 * @param {string[]} selectedIds
 */
function scoreCase(caseDef, selectedIds) {
  const routed = selectedIds.filter((id) => !BASE_SKILL_IDS.has(id));
  const routedSet = new Set(routed);
  const missing = caseDef.expected.filter((id) => !routedSet.has(id));
  const leaked = caseDef.forbidden.filter((id) => routedSet.has(id));
  const correct = missing.length === 0 && leaked.length === 0;
  return { id: caseDef.id, routed, missing, leaked, correct };
}

/**
 * Run the routing corpus against the real pipeline.
 * @param {object} [opts]
 * @param {string} [opts.projectPath]
 * @param {Array} [opts.corpus]
 */
export async function runSkillRoutingBenchmark(opts = {}) {
  const projectPath = opts.projectPath || process.cwd();
  const corpus = opts.corpus || SKILL_ROUTING_CORPUS;
  const cases = [];

  for (const caseDef of corpus) {
    const analysis = await analyze({ prompt: caseDef.prompt, projectPath });
    const selectedIds = (analysis.skills?.selected || []).map((s) => s.id);
    cases.push(scoreCase(caseDef, selectedIds));
  }

  const total = cases.length;
  const passed = cases.filter((c) => c.correct).length;
  const expectedTotal = corpus.reduce((n, c) => n + c.expected.length, 0);
  const expectedFound = corpus.reduce((n, c) => {
    const routedSet = new Set(cases.find((x) => x.id === c.id).routed);
    return n + c.expected.filter((id) => routedSet.has(id)).length;
  }, 0);
  const forbiddenTotal = corpus.reduce((n, c) => n + c.forbidden.length, 0);
  const forbiddenLeaked = cases.reduce((n, c) => n + c.leaked.length, 0);

  const recall = expectedTotal === 0 ? 1 : expectedFound / expectedTotal;
  const precision = forbiddenTotal === 0 ? 1 : 1 - forbiddenLeaked / forbiddenTotal;
  const accuracy = total === 0 ? 0 : passed / total;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    total,
    passed,
    accuracy,
    recall,
    precision,
    f1,
    expectedTotal,
    expectedFound,
    forbiddenTotal,
    forbiddenLeaked,
    cases,
  };
}
