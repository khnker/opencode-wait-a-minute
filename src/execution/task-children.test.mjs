import test from "node:test";
import assert from "node:assert/strict";
import { createTaskChildRegistry } from "./task-children.js";

test("settle aborts every tracked child and awaits the in-flight pass", async () => {
  const registry = createTaskChildRegistry();
  const aborted = [];
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });

  registry.trackChild("task-1", "child-a");
  registry.trackChild("task-1", "child-b");
  registry.trackPromise("task-1", pending);
  assert.equal(registry.hasChildren("task-1"), true);

  const settling = registry.settle("task-1", {
    abort: (id) => {
      aborted.push(id);
    },
  });
  release("done");
  const result = await settling;

  assert.deepEqual(aborted.sort(), ["child-a", "child-b"]);
  assert.equal(result.awaited, true);
  assert.equal(registry.hasChildren("task-1"), false);
});

test("settle swallows rejected passes and missing children", async () => {
  const registry = createTaskChildRegistry();
  registry.trackPromise("task-2", Promise.reject(new Error("boom")));
  const result = await registry.settle("task-2");
  assert.equal(result.awaited, true);
  assert.equal(registry.hasChildren("task-2"), false);

  const empty = await registry.settle("missing");
  assert.deepEqual(empty, { aborted: [], awaited: false });
});
