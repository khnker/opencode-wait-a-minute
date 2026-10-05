import test from "node:test";
import assert from "node:assert/strict";

import { ContextGraph } from "./context-graph.js";
import { buildRuntimeContextGraph } from "./runtime-context-graph.js";

// Fixture covering every runtime layer the builder claims to consume.
function buildFixture() {
  return {
    taskState: {
      taskId: "task-1",
      contract: { objective: "Assemble canonical runtime context" },
      requirements: [
        { id: "req-1", title: "First requirement" },
        { id: "req-2", title: "Second requirement" },
      ],
    },
    runState: { runId: "run-1", status: "active" },
    evidenceLineage: [
      { id: "ev-1", content: "Evidence one", status: "valid", requirementId: "req-1", source: "test" },
      { id: "ev-2", content: "Evidence two", requirementId: "missing" },
    ],
    decisions: [
      { id: "dec-1", summary: "Chose canonical builder", requirementId: "req-1" },
    ],
    constraints: [
      { id: "con-1", description: "No external deps", severity: "high", requirementId: "req-1" },
    ],
    artifacts: [
      { id: "art-1", path: "runtime-context-graph.js", kind: "code", requirementId: "req-2" },
    ],
    observations: [
      { id: "obs-1", content: "Observed stable ids", requirementId: "req-2" },
    ],
    hypotheses: [
      { id: "hyp-1", statement: "Graph layers compose", requirementId: "req-1" },
    ],
    experiments: [
      { id: "exp-1", description: "Run assertions", hypothesisId: "hyp-1", requirementId: "req-2" },
    ],
    cognitionState: { id: "cog-1", summary: "Focused", load: 0.2 },
  };
}

const graph = buildRuntimeContextGraph(buildFixture());

test("Runtime context graph test — builds a node per canonical runtime layer", () => {
  assert.equal(graph.getNode("task-1").type, "task");
  assert.equal(graph.getNode("req-1").type, "requirement");
  assert.equal(graph.getNode("req-2").type, "requirement");
  assert.equal(graph.getNode("req-1::output").type, "output");
  assert.equal(graph.getNode("ev-1").type, "evidence");
  assert.equal(graph.getNode("dec-1").type, "decision");
  assert.equal(graph.getNode("con-1").type, "constraint");
  assert.equal(graph.getNode("art-1").type, "artifact");
  assert.equal(graph.getNode("obs-1").type, "observation");
  assert.equal(graph.getNode("hyp-1").type, "claim");
  assert.equal(graph.getNode("exp-1").type, "action");
  assert.equal(graph.getNode("cog-1").type, "observation");
});

test("Runtime context graph test — preserves node reference identity", () => {
  const task = graph.getNode("task-1");
  assert.strictEqual(graph.getNode("task-1"), task);
  assert.ok(graph.getNodes("task").includes(task));
  // Typed retrieval returns the stored reference, not a structural copy.
  assert.strictEqual(graph.getNodes("task")[0], task);

  // Shadow output is its own node, linked back to the requirement by id.
  const shadow = graph.getNode("req-1::output");
  assert.notStrictEqual(shadow, graph.getNode("req-1"));
  assert.equal(shadow.metadata.shadowOf, "req-1");
});

test("Runtime context graph test — wires typed edges across layers", () => {
  const hasEdge = (from, type, to) =>
    graph.getEdgesFromByType(from, type).some((e) => e.to === to);

  assert.ok(hasEdge("task-1", "requires_completion", "req-1"));
  assert.ok(hasEdge("task-1", "related_to", "req-1::output"));

  // Evidence linked to a known requirement supports it...
  assert.ok(hasEdge("ev-1", "supports", "req-1"));
  // ...unknown requirement falls back to the task endpoint.
  assert.ok(hasEdge("ev-2", "supports", "task-1"));

  assert.ok(hasEdge("dec-1", "supports", "req-1"));

  // Constraint edges point from the constrained target into the constraint.
  assert.ok(graph.getEdgesFrom("req-1").some((e) => e.to === "con-1" && e.type === "related_to"));

  assert.ok(hasEdge("task-1", "produces", "art-1"));
  assert.ok(hasEdge("art-1", "supports", "req-2"));
  assert.ok(hasEdge("obs-1", "related_to", "req-2"));
  assert.ok(hasEdge("hyp-1", "related_to", "req-1"));
  assert.ok(hasEdge("exp-1", "supports", "hyp-1"));
  assert.ok(hasEdge("exp-1", "produces", "req-2"));
});

test("Runtime context graph test — returns an empty ContextGraph for no input", () => {
  const empty = buildRuntimeContextGraph();
  assert.ok(empty instanceof ContextGraph);
  assert.deepEqual(empty.getNodes(), []);
});
