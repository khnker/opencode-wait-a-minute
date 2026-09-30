import test from "node:test";
import assert from "node:assert";
import { createCollector, COUNTER_NAMES } from "./collector.mjs";
import { assembleContext } from "../../assembly.js";

test("Collector basic functionality", () => {
  const col = createCollector();
  
  // Check defaults
  const snap1 = col.snapshot();
  for (const name of COUNTER_NAMES) {
    assert.strictEqual(snap1[name], 0, `Counter ${name} should be 0`);
  }

  // Test record
  col.record("Context_assembled", 5);
  assert.strictEqual(col.snapshot().Context_assembled, 5);

  // Test set
  col.set("Mandatory_items", 10);
  assert.strictEqual(col.snapshot().Mandatory_items, 10);

  // Test reset
  col.reset();
  assert.strictEqual(col.snapshot().Context_assembled, 0);
  assert.strictEqual(col.snapshot().Mandatory_items, 0);
});

test("assembleContext additive property", () => {
  const params = {
    prompt: "test prompt",
    taskId: "t-1",
    projectPath: process.cwd(),
    budget: 1000
  };

  const resNoCol = assembleContext(params);
  const col = createCollector();
  const resCol = assembleContext({ ...params, collector: col });

  // Behavior must be identical
  assert.deepStrictEqual(resNoCol, resCol, "assembleContext output must be identical with/without collector");
  
  // Instrumentation must have worked
  const snap = col.snapshot();
  assert.strictEqual(snap.Context_assembled, 1);
});

test("COUNTER_NAMES completeness", () => {
  const expected = [
    "Context_assembled",
    "Context_reconstructed",
    "Context_fast_path",
    "Snapshot_hit",
    "Snapshot_miss",
    "Mandatory_items",
    "Conditional_items",
    "Optional_items",
    "Tokens_before",
    "Tokens_after",
    "Reconstruction_count",
  ];
  assert.deepStrictEqual(COUNTER_NAMES, expected);
});
