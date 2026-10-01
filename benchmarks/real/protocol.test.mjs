import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const realDir = here;

const SCENARIO_FILES = ["local.json", "contextual.json", "continuation.json", "negative.json"];

test("protocol.md states the four required rules", async () => {
  const md = await readFile(join(realDir, "protocol.md"), "utf8");
  assert.match(md, /Identical Inputs/);
  assert.match(md, /No Cross-Contamination/);
  assert.match(md, /Outcome Parity/);
  assert.match(md, /Metric Isolation/);
  // cachedInputTokens must be tracked separately from WAM input reduction
  assert.match(md, /cached_input_tokens/);
  assert.match(md, /separately/i);
});

test("config.schema.json parses as JSON and declares required fields", async () => {
  const raw = await readFile(join(realDir, "config.schema.json"), "utf8");
  const schema = JSON.parse(raw);
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  for (const field of ["experimentId", "model", "provider", "temperature", "maxTokens", "trials", "scenarios"]) {
    assert.ok(schema.properties[field], `missing property ${field}`);
  }
  assert.deepEqual(
    [...schema.required].sort(),
    ["experimentId", "model", "provider", "scenarios"]
  );
});

test("manifests/rc1.json parses as JSON and references all 4 scenarios", async () => {
  const raw = await readFile(join(realDir, "manifests", "rc1.json"), "utf8");
  const manifest = JSON.parse(raw);
  assert.equal(manifest.protocolVersion, "rc1");
  assert.equal(typeof manifest.experimentId, "string");
  assert.equal(typeof manifest.model, "string");
  assert.equal(typeof manifest.provider, "string");
  assert.equal(typeof manifest.trials, "number");
  assert.equal(manifest.scenarios.length, 4);
  for (const rel of manifest.scenarios) {
    const scenario = JSON.parse(await readFile(join(realDir, rel), "utf8"));
    assert.ok(Array.isArray(scenario.turns), `${rel} turns must be an array`);
  }
});

test("each scenario JSON parses as an array of turns with input+prompt", async () => {
  for (const file of SCENARIO_FILES) {
    const raw = await readFile(join(realDir, "scenarios", file), "utf8");
    const scenario = JSON.parse(raw);
    assert.equal(typeof scenario.id, "string", `${file} id`);
    assert.equal(typeof scenario.type, "string", `${file} type`);
    assert.ok(Array.isArray(scenario.turns), `${file} turns`);
    assert.ok(scenario.turns.length > 0, `${file} turns non-empty`);
    for (const turn of scenario.turns) {
      assert.ok(turn.input, `${file} turn.input`);
      assert.equal(typeof turn.prompt, "string", `${file} turn.prompt`);
    }
  }
});

test("continuation scenario has consistent taskId across turns", async () => {
  const raw = await readFile(join(realDir, "scenarios", "continuation.json"), "utf8");
  const scenario = JSON.parse(raw);
  const taskIds = scenario.turns.map((t) => t.input.taskId);
  assert.equal(new Set(taskIds).size, 1, "continuation turns must share one taskId");
});
