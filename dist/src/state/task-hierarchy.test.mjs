import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadTask, saveTask } from "./task-store.js";
import {
  TASK_SCOPES,
  consolidateTaskToGroup,
  getAncestry,
  getApplicableConstraints,
  getTaskScope,
  setTaskParent,
  validateTaskLink,
} from "./task-hierarchy.js";

function tempRoot(t) {
  const root = mkdtempSync(path.join(tmpdir(), "wam-hierarchy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeTask(taskId, overrides = {}) {
  return {
    taskId,
    phase: "IMPLEMENTING",
    contract: { status: "DRAFT", requirements: [] },
    requirements: [],
    nextAction: null,
    createdAt: 1,
    updatedAt: 1,
    goalAssessment: null,
    ...overrides,
  };
}

function create(root, taskId, overrides = {}) {
  const task = makeTask(taskId, overrides);
  saveTask(taskId, task, root);
  return task;
}

function listFiles(dir, base = dir, out = []) {
  if (!readdirSync(dir, { withFileTypes: true }).length) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) listFiles(full, base, out);
    else out.push(rel);
  }
  return out.sort();
}

test("scope enum is re-exported from phase 1", () => {
  assert.deepEqual([...TASK_SCOPES], ["project", "group", "task", "session"]);
});

test("legacy task without scope loads and validates", (t) => {
  const root = tempRoot(t);
  create(root, "legacy");

  const loaded = loadTask("legacy", root);
  assert.equal(loaded.taskId, "legacy");
  assert.equal(loaded.scope, undefined);
  assert.equal(loaded.parentId, undefined);

  assert.deepEqual(validateTaskLink([loaded], { taskId: "legacy", parentId: null }), {
    ok: true,
    errors: [],
  });
  assert.deepEqual(getTaskScope(root, "legacy"), {
    scope: "project",
    projectId: "legacy",
    groupId: null,
    sessionId: null,
  });
});

test("self parent is rejected without writing", (t) => {
  const root = tempRoot(t);
  create(root, "a");

  const result = setTaskParent(root, "a", "a");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /own parent/);
  assert.equal(loadTask("a", root).parentId, undefined);
});

test("cycle is rejected without writing", (t) => {
  const root = tempRoot(t);
  create(root, "a");
  create(root, "b", { parentId: "a" });
  create(root, "c", { parentId: "b" });

  const result = setTaskParent(root, "a", "c");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /cycle/);
  assert.equal(loadTask("a", root).parentId, undefined);
});

test("session cannot parent a group", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project" });
  create(root, "g", { scope: "group", parentId: "p" });
  create(root, "p2", { scope: "project" });
  create(root, "s2", { scope: "session", parentId: "p2", sessionId: "sess-2" });

  const result = setTaskParent(root, "g", "s2");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /level ordering/);
  assert.equal(loadTask("g", root).parentId, "p");
});

test("valid project → group → task → session chain resolves", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project" });
  create(root, "g", { scope: "group", parentId: "p" });
  create(root, "task", { scope: "task", parentId: "g" });
  create(root, "s", { scope: "session", parentId: "task", sessionId: "sess-1" });

  assert.deepEqual(
    getAncestry(root, "s").map((task) => task.taskId),
    ["p", "g", "task", "s"]
  );
  assert.deepEqual(getTaskScope(root, "s"), {
    scope: "session",
    projectId: "p",
    groupId: "g",
    sessionId: "sess-1",
  });
});

test("constraints inherit from project/group only, not entries", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project", constraints: ["alpha", "beta"], requirements: [{ status: "done" }] });
  create(root, "g", { scope: "group", parentId: "p", constraints: ["beta", "gamma"] });
  create(root, "task", { scope: "task", parentId: "g", constraints: ["task-only"] });
  create(root, "s", { scope: "session", parentId: "task", constraints: ["session-only"] });

  assert.deepEqual(getApplicableConstraints(root, "s"), ["alpha", "beta", "gamma"]);
});

test("consolidation is idempotent and confined to the parent group", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project" });
  create(root, "g", { scope: "group", parentId: "p" });
  create(root, "a", {
    scope: "task",
    parentId: "g",
    requirements: [{ done: true }, { status: "done" }, {}],
    nextAction: "finish",
    updatedAt: 100,
  });
  create(root, "b", { scope: "task", parentId: "g", updatedAt: 200 });

  const siblingBefore = readFileSync(path.join(root, ".wam", "tasks", "b", "task.json"), "utf8");
  const nonTaskBefore = listFiles(path.join(root, ".wam"))
    .filter((rel) => !rel.includes("tasks") && rel !== "task-state.json");

  const first = consolidateTaskToGroup(root, "a");
  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(first.entry.requirementsDone, 2);

  const second = consolidateTaskToGroup(root, "a");
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.equal(second.count, 1);

  const group = loadTask("g", root);
  assert.equal(group.consolidated.length, 1);
  assert.equal(group.consolidated[0].taskId, "a");
  assert.equal(group.consolidated[0].nextAction, "finish");

  const sibling = loadTask("b", root);
  assert.equal(sibling.consolidated, undefined);
  assert.equal(
    readFileSync(path.join(root, ".wam", "tasks", "b", "task.json"), "utf8"),
    siblingBefore
  );

  const nonTaskAfter = listFiles(path.join(root, ".wam"))
    .filter((rel) => !rel.includes("tasks") && rel !== "task-state.json");
  assert.deepEqual(nonTaskAfter, nonTaskBefore);
});

test("consolidation is bounded to 20 and deduped by taskId", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project" });
  create(root, "g", { scope: "group", parentId: "p" });

  for (let i = 0; i < 22; i += 1) {
    const id = `child-${String(i).padStart(2, "0")}`;
    create(root, id, { scope: "task", parentId: "g", updatedAt: i + 1 });
    assert.equal(consolidateTaskToGroup(root, id).ok, true);
  }

  const consolidated = loadTask("g", root).consolidated;
  assert.equal(consolidated.length, 20);
  assert.equal(consolidated[0].taskId, "child-02");
  assert.equal(consolidated[19].taskId, "child-21");

  const repeated = consolidateTaskToGroup(root, "child-21");
  assert.equal(repeated.changed, false);
  assert.equal(loadTask("g", root).consolidated.length, 20);
});

test("missing parent returns errors instead of throwing", (t) => {
  const root = tempRoot(t);
  create(root, "a");

  const result = setTaskParent(root, "a", "ghost");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /not found/);
  assert.equal(loadTask("a", root).parentId, undefined);

  assert.doesNotThrow(() => validateTaskLink(null, { taskId: "a", parentId: "ghost" }));
  const validated = validateTaskLink([loadTask("a", root)], { taskId: "a", parentId: "ghost" });
  assert.equal(validated.ok, false);
  assert.match(validated.errors.join(" "), /not found/);
});

test("consolidating a non-group parent is rejected", (t) => {
  const root = tempRoot(t);
  create(root, "p", { scope: "project" });
  create(root, "a", { scope: "task", parentId: "p" });

  const result = consolidateTaskToGroup(root, "a");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /not a group/);
  assert.equal(statSync(path.join(root, ".wam", "tasks", "p", "task.json")).isFile(), true);
  assert.equal(loadTask("p", root).consolidated, undefined);
});
