import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { parseFrontmatter, toContract, buildSkillGraph, detectCycle, topoSort, validateActivation, recordExecutedGraph, getExecutedGraph, planExecution, preserveStateAcrossTransition } from "./skill-composition.js";

test("parseFrontmatter: scalars with quote stripping and number/bool coercion", () => {
  const text = [
    "---",
    'name: "alpha"',
    "priority: 7",
    "enabled: true",
    "fallback: null",
    "---",
    "body line 1",
    "body line 2",
  ].join("\n");
  const { data, body } = parseFrontmatter(text);
  assert.equal(data.name, "alpha");
  assert.equal(data.priority, 7);
  assert.equal(data.enabled, true);
  assert.equal(data.fallback, null);
  assert.equal(body, "body line 1\nbody line 2");
});

test("parseFrontmatter: inline array", () => {
  const text = "---\nname: beta\ninputs: [a, b, c]\n---\nbody";
  const { data } = parseFrontmatter(text);
  assert.deepEqual(data.inputs, ["a", "b", "c"]);
});

test("parseFrontmatter: block array", () => {
  const text = "---\nname: gamma\nrequires:\n  - foo\n  - bar\noutputs:\n  - x\n---\nbody";
  const { data } = parseFrontmatter(text);
  assert.deepEqual(data.requires, ["foo", "bar"]);
  assert.deepEqual(data.outputs, ["x"]);
});

test("parseFrontmatter: no frontmatter returns empty data and original text", () => {
  const text = "no frontmatter here\njust body";
  const { data, body } = parseFrontmatter(text);
  assert.deepEqual(data, {});
  assert.equal(body, text);
});

test("toContract: maps all fields with defaults", () => {
  const c = toContract({ name: "s1", outputs: ["x"] });
  assert.equal(c.id, "s1");
  assert.deepEqual(c.inputs, []);
  assert.deepEqual(c.outputs, ["x"]);
  assert.deepEqual(c.requires, []);
  assert.deepEqual(c.optional, []);
  assert.equal(c.fallback, null);
});

test("toContract: defaults arrays when missing and preserves provided arrays", () => {
  const c = toContract({
    name: "s2",
    inputs: ["i"],
    requires: ["r"],
    optional: ["o"],
    fallback: "fb",
  });
  assert.deepEqual(c.inputs, ["i"]);
  assert.deepEqual(c.requires, ["r"]);
  assert.deepEqual(c.optional, ["o"]);
  assert.equal(c.fallback, "fb");
});

test("buildSkillGraph: builds nodes and required/optional edges, deterministic order", () => {
  const contracts = {
    A: { id: "A", outputs: ["x"], requires: [], optional: [] },
    B: { id: "B", outputs: ["y"], requires: ["A"], optional: ["C"] },
    C: { id: "C", outputs: ["z"], requires: [], optional: [] },
  };
  const g = buildSkillGraph(contracts);
  assert.deepEqual(g.nodes.map((n) => n.id), ["A", "B", "C"]);
  assert.deepEqual(g.edges, [
    { from: "A", to: "B", kind: "required" },
    { from: "C", to: "B", kind: "optional" },
  ]);
});

test("detectCycle: null for an acyclic graph", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: [], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: [] },
    C: { id: "C", outputs: [], requires: ["B"], optional: [] },
  });
  assert.equal(detectCycle(g), null);
});

test("detectCycle: returns cycle path for A -> B -> A", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: ["B"], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: [] },
  });
  const cycle = detectCycle(g);
  assert.ok(cycle);
  assert.deepEqual(cycle, ["A", "B", "A"]);
});

test("topoSort: dependencies precede dependents and is deterministic", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: [], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: [] },
    C: { id: "C", outputs: [], requires: ["A"], optional: [] },
    D: { id: "D", outputs: [], requires: ["B", "C"], optional: [] },
  });
  const order = topoSort(g);
  assert.equal(order.indexOf("A") < order.indexOf("B"), true);
  assert.equal(order.indexOf("A") < order.indexOf("C"), true);
  assert.equal(order.indexOf("B") < order.indexOf("D"), true);
  assert.equal(order.indexOf("C") < order.indexOf("D"), true);
});

test("topoSort: throws on cycle with descriptive message", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: ["B"], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: [] },
  });
  assert.throws(
    () => topoSort(g),
    (err) => /cycle/.test(err.message),
  );
});

test("validateActivation: ok when all required are produced", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: [], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: ["C"] },
  });
  const res = validateActivation(g, ["A"]);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.order, ["A", "B"]);
});

test("validateActivation: errors when a required dependency is missing", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: [], optional: [] },
    B: { id: "B", outputs: [], requires: ["A"], optional: [] },
  });
  const res = validateActivation(g, []);
  assert.equal(res.ok, false);
  assert.deepEqual(res.errors, [{ skill: "B", missing: ["A"] }]);
});

test("validateActivation: optional missing does NOT error", () => {
  const g = buildSkillGraph({
    A: { id: "A", outputs: [], requires: [], optional: [] },
    B: { id: "B", outputs: [], requires: [], optional: ["A"] },
  });
  const res = validateActivation(g, []);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
});

test("validateActivation: no implicit text dependency — only declared requires checked", () => {
  const g = buildSkillGraph({
    X: { id: "X", outputs: [], requires: [], optional: [] },
  });
  const res = validateActivation(g, []);
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, []);
});

test("recordExecutedGraph + getExecutedGraph round-trip", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-comp-"));
  try {
    const g = buildSkillGraph({
      A: { id: "A", outputs: [], requires: [], optional: [] },
      B: { id: "B", outputs: [], requires: ["A"], optional: [] },
    });
    const order = topoSort(g);
    const file = recordExecutedGraph("task-rt-1", g, order, tmp);
    assert.ok(fs.existsSync(file));
    const loaded = getExecutedGraph("task-rt-1", tmp);
    assert.ok(loaded);
    assert.equal(loaded.taskId, "task-rt-1");
    assert.deepEqual(loaded.executedOrder, ["A", "B"]);
    assert.equal(loaded.nodes.length, 2);
    assert.equal(loaded.nodes[0].id, "A");
    assert.equal(loaded.nodes[1].id, "B");
    assert.ok(loaded.recordedAt);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("getExecutedGraph: returns null when absent", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-comp-"));
  try {
    assert.equal(getExecutedGraph("nope", tmp), null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("integration: A.outputs.x -> B.requires.A; topoSort then record+replay", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wam-comp-"));
  try {
    const text = [
      "---",
      "name: A",
      "outputs: [x]",
      "---",
      "A skill body",
    ].join("\n");
    const { data: dataA } = parseFrontmatter(text);
    const a = toContract(dataA);

    const textB = [
      "---",
      "name: B",
      "requires: [A]",
      "---",
      "B skill body",
    ].join("\n");
    const { data: dataB } = parseFrontmatter(textB);
    const b = toContract(dataB);

    const g = buildSkillGraph({ [a.id]: a, [b.id]: b });
    const order = topoSort(g);
    assert.deepEqual(order, ["A", "B"]);

    const file = recordExecutedGraph("task-int-1", g, order, tmp);
    assert.ok(fs.existsSync(file));

    const loaded = getExecutedGraph("task-int-1", tmp);
    assert.equal(loaded.nodes.length, 2);
    const ids = loaded.nodes.map((n) => n.id);
    assert.deepEqual(ids.slice().sort(), ["A", "B"]);
    assert.equal(loaded.nodes.findIndex((n) => n.id === order[0]) < loaded.nodes.findIndex((n) => n.id === order[1]), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("planExecution passes artifacts by id and orders sequentially", () => {
  const graph = buildSkillGraph({
    A: { id: "A", outputs: ["x"], requires: [], optional: [] },
    B: { id: "B", outputs: ["y"], requires: ["A"], optional: [] },
  });
  const plan = planExecution(graph, []);
  assert.deepEqual(plan.order, ["A", "B"]);
  assert.deepEqual(plan.steps[1].receives, [{ artifact: "x", from: "A" }]);
  assert.equal(plan.ok, true);
});

test("preserveStateAcrossTransition keeps contract/requirements/claims and appends trail", () => {
  const state = { contract: { status: "APPROVED" }, requirements: [{ id: "r1" }], claims: [{ id: "c1" }] };
  const next = preserveStateAcrossTransition(state, { executedSkill: "A", produced: ["x"] });
  assert.strictEqual(next.contract, state.contract);
  assert.strictEqual(next.requirements, state.requirements);
  assert.strictEqual(next.claims, state.claims);
  assert.equal(next.skillTrail.length, 1);
  assert.equal(next.skillTrail[0].skill, "A");
});
