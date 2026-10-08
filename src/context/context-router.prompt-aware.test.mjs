/**
 * Regression tests for prompt-aware category-node admission in the
 * Context Router (Phase 2.5).
 *
 * Invariants under test:
 *   1. When the user prompt mentions a category type name (e.g. "decision",
 *      "evidence") or shares a significant token with a category node's
 *      text, that node IS admitted into the required closure.
 *   2. When the user prompt does NOT reference the category, the node is
 *      NOT admitted — preserving the token-saving contract.
 *   3. When `promptTokens` is omitted (null/undefined/empty), NO category
 *      nodes are admitted — conservative fallback so savings are never
 *      silently blown by callers that didn't opt in.
 *   4. Category nodes that ARE admitted remain CONDITIONAL; they must
 *      never be upgraded to MANDATORY purely because they touch the task.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveContext, ADMISSION } from "./context-router.js";
import { ContextGraph } from "./context-graph.js";

function buildGraphWithCategory({ taskId, taskContent, category }) {
  // category = { id, type, content }
  // Wire category --supports--> task so it shows up via getEdgesTo(taskId).
  const g = new ContextGraph();
  g.addNode({
    id: taskId,
    type: "task",
    content: taskContent,
    createdAt: 1,
  });
  g.addNode({
    id: category.id,
    type: category.type,
    content: category.content,
    createdAt: 2,
    summary: category.summary || "",
    description: category.description || "",
  });
  g.addEdge({
    from: category.id,
    to: taskId,
    type: "supports",
    createdAt: 2,
  });
  return g;
}

test("prompt-aware: prompt mentions category type name → node admitted", () => {
  const taskId = "task-1";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Verify the cluster decision is recorded",
    category: {
      id: "dec-cluster",
      type: "decision",
      content: "Use Postgres as primary datastore",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["verify", "cluster", "decision"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    ids.includes("dec-cluster"),
    `expected dec-cluster in nodes, got [${ids.join(", ")}]`
  );
});

test("prompt-aware: prompt shares a significant token with node text → node admitted", () => {
  const taskId = "task-2";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Investigate the failover",
    category: {
      id: "ev-postgres-failover",
      type: "evidence",
      content: "Postgres failover took 14s during chaos drill 2026-09-12",
    },
  });

  // "failover" appears in BOTH the prompt and the evidence node's text.
  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["investigate", "failover"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    ids.includes("ev-postgres-failover"),
    `expected evidence node admitted via token overlap, got [${ids.join(", ")}]`
  );
});

test("prompt-aware: prompt does NOT reference category → node excluded (savings preserved)", () => {
  const taskId = "task-3";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Summarize weekly sprint outcomes",
    category: {
      id: "ev-irrelevant",
      type: "evidence",
      content: "Postgres failover took 14s during chaos drill 2026-09-12",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["summarize", "weekly", "sprint", "outcomes"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    !ids.includes("ev-irrelevant"),
    `evidence node must be excluded when prompt is unrelated; got [${ids.join(", ")}]`
  );
});

test("prompt-aware: plural type name match also admits node", () => {
  const taskId = "task-3b";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Aggregate evidence logs",
    category: {
      id: "ev-1",
      type: "evidence",
      content: "some unrelated blob about pricing tiers",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["aggregate", "evidences"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    ids.includes("ev-1"),
    `plural 'evidences' in prompt should admit evidence node; got [${ids.join(", ")}]`
  );
});

test("prompt-aware: null promptTokens → no category node admitted (conservative fallback)", () => {
  const taskId = "task-4";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Task body",
    category: {
      id: "dec-1",
      type: "decision",
      content: "Use Postgres",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    !ids.includes("dec-1"),
    `null promptTokens must keep category nodes out; got [${ids.join(", ")}]`
  );
});

test("prompt-aware: empty promptTokens → no category node admitted", () => {
  const taskId = "task-5";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Task body",
    category: {
      id: "obs-1",
      type: "observation",
      content: "latency spike at 14:32 UTC",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: [],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    !ids.includes("obs-1"),
    `empty promptTokens must keep category nodes out; got [${ids.join(", ")}]`
  );
});

test("prompt-aware: stopword-only prompt must not admit node via stopword match", () => {
  const taskId = "task-6";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Task body",
    category: {
      id: "dec-2",
      type: "decision",
      // contains only stopword-like tokens ("the", "and", "for")
      content: "the and for the and for",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["the", "and", "for", "this", "that"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(
    !ids.includes("dec-2"),
    `stopword-only overlap must not admit the node; got [${ids.join(", ")}]`
  );
});

test("prompt-aware: admitted category nodes stay CONDITIONAL, never MANDATORY", () => {
  const taskId = "task-7";
  const graph = buildGraphWithCategory({
    taskId,
    taskContent: "Validate the evidence",
    category: {
      id: "ev-2",
      type: "evidence",
      content: "Latency spike confirmed by prometheus dashboard",
    },
  });

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["validate", "evidence"],
  });

  const ids = result.nodes.map((n) => n.id);
  assert.ok(ids.includes("ev-2"), "evidence node should be admitted");
  // ev-2 must NOT appear in `omitted` (it's in the closure), and must
  // not be reported as a mandatory-omitted node if it were. The category
  // node is required for selection but must be admitted as CONDITIONAL.
  const mandatoryOmitted = (result.omitted || []).filter(
    (o) => o.id === "ev-2" && o.admission === ADMISSION.MANDATORY
  );
  assert.equal(
    mandatoryOmitted.length,
    0,
    "category node must never be reported as mandatory-omitted"
  );
});

test("prompt-aware: per-type cap still applies under prompt-aware gating", () => {
  const taskId = "task-8";
  const g = new ContextGraph();
  g.addNode({ id: taskId, type: "task", content: "review decisions", createdAt: 1 });
  for (let i = 0; i < 12; i += 1) {
    g.addNode({
      id: `dec-${i}`,
      type: "decision",
      content: `decision number ${i} about postgres rollout`,
      createdAt: 2 + i,
    });
    g.addEdge({ from: `dec-${i}`, to: taskId, type: "supports", createdAt: 2 + i });
  }
  const graph = g;

  const result = resolveContext(graph, {
    taskId,
    maxTokens: 4000,
    promptTokens: ["review", "decisions"],
  });

  const admittedDecisions = result.nodes.filter((n) => n.id.startsWith("dec-"));
  assert.ok(
    admittedDecisions.length <= 5,
    `per-type cap must bound admissions to <=5, got ${admittedDecisions.length}`
  );
});