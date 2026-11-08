import test from "node:test";
import assert from "node:assert/strict";

import { ContextGraph } from "../../src/context/context-graph.js";
import { resolveContext } from "../../src/context/context-router.js";

function baseGraph() {
  const graph = new ContextGraph();
  graph.addNode({ id: "task-1", type: "task", content: "Implement the feature" });
  graph.addNode({ id: "req-1", type: "requirement", content: "Persist evidence" });
  graph.addEdge({ from: "task-1", to: "req-1", type: "requires_completion" });
  return graph;
}

test("resolveContext selects requirement evidence without a prompt keyword match", () => {
  const graph = baseGraph();
  graph.addNode({
    id: "ev-1",
    type: "evidence",
    content: "The evidence payload is persisted",
    verified: true,
    metadata: { provenance: "run_execution" },
  });
  graph.addEdge({ from: "ev-1", to: "req-1", type: "supports" });

  const result = resolveContext(graph, {
    taskId: "task-1",
    promptTokens: ["completely", "unrelated", "words"],
  });

  assert.ok(result.nodes.some((node) => node.id === "ev-1"));
});

test("resolveContext prefers valid evidence over invalid evidence under the cap", () => {
  const graph = baseGraph();
  graph.addNode({
    id: "ev-valid",
    type: "evidence",
    content: "Verified evidence",
    verified: true,
    metadata: { provenance: "run_execution", createdAt: 1 },
  });
  graph.addEdge({ from: "ev-valid", to: "req-1", type: "supports" });

  for (let index = 0; index < 4; index += 1) {
    graph.addNode({
      id: `ev-bad-${index}`,
      type: "evidence",
      content: `Invalid evidence ${index}`,
      verified: false,
      metadata: { provenance: "run_execution", createdAt: index + 10 },
    });
    graph.addEdge({ from: `ev-bad-${index}`, to: "req-1", type: "supports" });
  }

  const result = resolveContext(graph, {
    taskId: "task-1",
    promptTokens: ["unrelated"],
  });
  const ids = result.nodes.map((node) => node.id);

  assert.ok(ids.includes("ev-valid"));
  assert.ok(!ids.includes("ev-bad-0"));
});
