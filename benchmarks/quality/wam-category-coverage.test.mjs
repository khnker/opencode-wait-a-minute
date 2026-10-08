/**
 * Regression test for the WAM context-assembly bug.
 *
 * Bug: decision, evidence, constraint, and observation nodes attached to a
 * task were silently dropped before selection in resolveContext() because
 * the edges wiring them (supports, related_to) are not traversed by
 * getDependencies() — only the 5 causal edge types are.
 *
 * Fix: Phase 2.5 in resolveContext() now admits category nodes attached
 * to the task as CONDITIONAL (subject to budget cap, so token savings
 * are preserved).
 *
 * This test inlines the WAM prompt construction (independent of
 * benchmarks/quality/scenarios.mjs and the paired-runner exports) and
 * asserts that the assembled WAM prompt contains the prompt-relevant
 * category facts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeContextGraph } from "../../src/context/runtime-context-graph.js";
import { assembleContext } from "../../src/context/assembly.js";

const filler = (tag, i, len = 400) => `${tag}[${i}] `.padEnd(len, "context");
const requirements = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}R${i}`, title: filler(`${prefix}-requirement`, i) }));
const evidence = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}E${i}`,
    content: filler(`${prefix}-evidence`, i),
    status: "valid",
  }));
const decisions = (n, prefix) =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}D${i}`, summary: filler(`${prefix}-decision`, i) }));

function makeInput({ taskId, objective, reqs, evs, decs }) {
  const prefix = `${taskId}:`;
  return {
    taskState: {
      taskId,
      contract: { objective: filler(objective, 0) },
      requirements: requirements(reqs, prefix),
    },
    runState: {},
    evidenceLineage: evidence(evs, prefix),
    decisions: decisions(decs, prefix),
    constraints: [],
    artifacts: [],
    observations: [],
    hypotheses: [],
    experiments: [],
  };
}

// Inline the same logic as buildBaselineRequest + buildWamRequest
// (paired-runner.mjs), without depending on its (uncommitted) exports.
function buildBaseline(turn) {
  const graph = buildRuntimeContextGraph(turn.input);
  const nodes = Array.from(graph.getNodes().values()).sort((a, b) => a.createdAt - b.createdAt);
  const rawContext = nodes.map((n) => `[Type: ${n.type}]\n${n.content}\n---`).join("\n");
  return `${rawContext}\n\n[Task]\n${turn.prompt}`;
}
function buildWam(scenario, turn) {
  const assembly = assembleContext({
    prompt: turn.prompt,
    taskId: scenario.id,
    ...turn.input,
    budget: turn.budget ?? 4000,
  });
  const lines = [...assembly.lines, `[Task]\n${turn.prompt}`];
  return lines.join("\n");
}

// Simple case/whitespace normalizer (lowercase + collapse whitespace).
// Mirrors the spirit of scoring.mjs#normalize() without taking a hard dep on
// the broken upstream import.
const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

test("REGRESSION: WAM prompt retains decision fact (Q2-decision-token shape)", () => {
  const input = makeInput({ taskId: "Q2", objective: "decision-token", reqs: 3, evs: 2, decs: 5 });
  const scenario = { id: "Q2-decision-token", budget: 4000, turns: [{ prompt: "decision summary token", input, budget: 4000 }] };
  const content = buildWam(scenario, scenario.turns[0]);
  assert.ok(
    normalize(content).includes(normalize("q2:-decision[3]")),
    `WAM REGRESSION: Q2 WAM prompt must include "q2:-decision[3]". ` +
      `Got first 400 chars: ${content.slice(0, 400)}`
  );
});

test("REGRESSION: WAM prompt retains evidence fact (Q4-evidence-token shape)", () => {
  const input = makeInput({ taskId: "Q4", objective: "evidence-token", reqs: 2, evs: 9, decs: 2 });
  const scenario = { id: "Q4-evidence-token", budget: 4000, turns: [{ prompt: "evidence token", input, budget: 4000 }] };
  const content = buildWam(scenario, scenario.turns[0]);
  assert.ok(
    normalize(content).includes(normalize("q4:-evidence[4]")),
    `WAM REGRESSION: Q4 WAM prompt must include "q4:-evidence[4]". ` +
      `Got first 400 chars: ${content.slice(0, 400)}`
  );
});

test("REGRESSION: WAM prompt retains requirement fact (Q1-exact-req-token shape)", () => {
  // Requirement edge already worked before the fix (task → requires_completion → req
  // is traversed by getDependencies). This guard ensures the fix did not break
  // the requirement path.
  const input = makeInput({ taskId: "Q1", objective: "exact-req-token", reqs: 6, evs: 2, decs: 2 });
  const scenario = { id: "Q1-exact-req-token", budget: 4000, turns: [{ prompt: "requirement token", input, budget: 4000 }] };
  const content = buildWam(scenario, scenario.turns[0]);
  assert.ok(
    normalize(content).includes(normalize("q1:-requirement[3]")),
    `WAM REGRESSION: Q1 WAM prompt must include "q1:-requirement[3]". ` +
      `Got first 400 chars: ${content.slice(0, 400)}`
  );
});

test("REGRESSION: token savings not materially degraded by category inclusion", () => {
  // Spot-check: for a typical scenario, baseline/WAM input ratio should still
  // be a meaningful reduction (>=5%). The fix adds CONDITIONAL category nodes
  // to the candidate set, but the existing budget cap in Phase 6b keeps
  // the assembled WAM prompt small.
  const input = makeInput({ taskId: "Q4", objective: "evidence-token", reqs: 2, evs: 9, decs: 2 });
  const scenario = { id: "Q4-evidence-token", budget: 4000, turns: [{ prompt: "evidence token", input, budget: 4000 }] };
  const base = buildBaseline(scenario.turns[0]);
  const wam = buildWam(scenario, scenario.turns[0]);
  const reductionPct = ((base.length - wam.length) / base.length) * 100;
  assert.ok(
    reductionPct >= 5,
    `Token savings regression: expected >=5% reduction, got ${reductionPct.toFixed(1)}% (base=${base.length}, wam=${wam.length})`
  );
});
