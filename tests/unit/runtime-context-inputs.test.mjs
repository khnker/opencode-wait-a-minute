import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadRuntimeContextInputs } from "../../src/context/runtime-context-inputs.js";

function taskRoot(root, taskId = "task-1") {
  return path.join(root, ".wam", "tasks", taskId);
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function writeJsonl(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-runtime-inputs-"));
}

test("loadRuntimeContextInputs returns empty defaults without taskId or root", () => {
  const result = loadRuntimeContextInputs({ taskState: { phase: "PROPOSED" } });
  assert.deepEqual(result.evidenceLineage, []);
  assert.equal(result.runState, null);
  assert.equal(result.cognitionState, null);
  assert.deepEqual(result.artifacts, []);
  assert.equal(result.taskState.taskId, undefined);
  assert.equal(result.taskState.phase, "PROPOSED");
});

test("loadRuntimeContextInputs normalizes taskState taskId", () => {
  const result = loadRuntimeContextInputs({
    taskId: "task-1",
    taskState: { phase: "IMPLEMENTING" },
  });
  assert.equal(result.taskState.taskId, "task-1");
  assert.equal(result.taskState.phase, "IMPLEMENTING");
});

test("loadRuntimeContextInputs falls back to agentRun decisions when no runs exist", () => {
  const root = makeRoot();
  try {
    const taskState = {
      taskId: "task-1",
      agentRun: {
        results: [
          {
            role: "ANALYST",
            status: "COMPLETED",
            summary: "The route is healthy; fix the mobile selector test.",
          },
        ],
      },
    };

    const result = loadRuntimeContextInputs({ taskId: "task-1", root, taskState });

    assert.equal(result.runState, null);
    assert.equal(result.decisions.length, 1);
    assert.equal(result.decisions[0].id, "agent-result-1");
    assert.match(result.decisions[0].summary, /mobile selector/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadRuntimeContextInputs loads, filters, bounds, and truncates runtime layers", () => {
  const root = makeRoot();
  try {
    const dir = taskRoot(root);
    const decisions = Array.from({ length: 25 }, (_, index) => ({
      description: `decision ${index}`,
      requirementId: "req-1",
      madeAt: index,
    }));
    const runObservations = Array.from({ length: 30 }, (_, index) => ({
      id: `run-obs-${index}`,
      text: `run observation ${index}`,
      requirementId: "req-1",
    }));

    writeJson(path.join(dir, "runs", "run-1.json"), {
      id: "run-1",
      taskId: "task-1",
      status: "active",
      startedAt: 1,
      completedAt: 100,
      actions: [],
      observations: runObservations,
      decisions,
    });

    for (let index = 0; index < 35; index += 1) {
      writeJson(path.join(dir, "lineage", `ev-${index}.json`), {
        id: `ev-${index}`,
        requirementId: "req-1",
        content: "x".repeat(700),
        status: index % 2 === 0 ? "valid" : "pending",
        createdAt: index,
      });
    }
    writeJson(path.join(dir, "lineage", "ev-foreign.json"), {
      id: "ev-foreign",
      requirementId: "req-other",
      content: "not for this task",
      status: "valid",
      createdAt: 999,
    });

    writeJsonl(
      path.join(dir, "cognition", "observations.jsonl"),
      Array.from({ length: 8 }, (_, index) => ({
        id: `cog-obs-${index}`,
        result: `cognition observation ${index}`,
        createdAt: 200 + index,
      })),
    );
    writeJsonl(
      path.join(dir, "cognition", "hypotheses.jsonl"),
      Array.from({ length: 12 }, (_, index) => ({
        id: `hyp-${index}`,
        statement: `hypothesis ${index}`,
        status: "proposed",
        createdAt: index,
      })),
    );
    writeJsonl(
      path.join(dir, "cognition", "experiments.jsonl"),
      Array.from({ length: 12 }, (_, index) => ({
        id: `exp-${index}`,
        actionDescription: `experiment ${index}`,
        status: "completed",
        createdAt: index,
      })),
    );

    const taskState = {
      taskId: "task-1",
      currentRunId: "run-1",
      requirements: [{ id: "req-1", title: "Requirement" }],
      contract: {
        constraints: Array.from({ length: 12 }, (_, index) => `constraint ${index}`),
      },
    };

    const result = loadRuntimeContextInputs({ taskId: "task-1", root, taskState });

    assert.deepEqual(result.taskState, taskState);
    assert.equal(result.runState.id, "run-1");

    assert.equal(result.evidenceLineage.length, 30);
    assert.ok(result.evidenceLineage.every((ev) => ev.requirementId === "req-1"));
    assert.ok(result.evidenceLineage.every((ev) => ev.content.length === 500));
    assert.equal(result.evidenceLineage[0].status, "valid");
    assert.ok(!result.evidenceLineage.some((ev) => ev.id === "ev-foreign"));

    assert.equal(result.decisions.length, 20);
    assert.equal(result.decisions[0].id, "dec-run-1-6");
    assert.equal(result.decisions[0].summary, "decision 5");

    assert.equal(result.observations.length, 20);
    assert.ok(result.observations.every((obs) => typeof obs.content === "string"));
    assert.ok(
      result.observations.some((obs) => obs.content.startsWith("cognition observation")),
    );

    assert.equal(result.hypotheses.length, 10);
    assert.equal(result.experiments.length, 5);
    assert.equal(result.constraints.length, 10);
    assert.deepEqual(result.constraints[0], {
      id: "constraint-1",
      description: "constraint 0",
      provenance: "user_decided",
    });
    assert.deepEqual(result.artifacts, []);
    assert.equal(result.cognitionState, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadRuntimeContextInputs fails soft on corrupt persisted files", () => {
  const root = makeRoot();
  try {
    const dir = taskRoot(root);
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "runs", "broken.json"), "{not json");
    fs.mkdirSync(path.join(dir, "lineage"), { recursive: true });
    fs.writeFileSync(path.join(dir, "lineage", "broken.json"), "{not json");
    fs.mkdirSync(path.join(dir, "cognition"), { recursive: true });
    fs.writeFileSync(path.join(dir, "cognition", "hypotheses.jsonl"), "not json\n");

    const result = loadRuntimeContextInputs({
      taskId: "task-1",
      root,
      taskState: { taskId: "task-1" },
    });

    assert.deepEqual(result.evidenceLineage, []);
    assert.deepEqual(result.hypotheses, []);
    assert.deepEqual(result.observations, []);
    assert.deepEqual(result.decisions, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
