import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BENCHMARK_CONFIG_IDS,
  BENCHMARK_SCHEMA,
  BENCHMARK_TASK_KINDS,
  assertRunRecord,
  validateRunRecord,
} from "./schema.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "golden-run.json"), "utf8"));

test("golden record is valid and reproducible", () => {
  const first = validateRunRecord(GOLDEN);
  const second = validateRunRecord(structuredClone(GOLDEN));
  assert.deepEqual(first, { valid: true, errors: [] });
  assert.deepEqual(first, second);
});

test("assertRunRecord returns the record and throws with errors on failure", () => {
  assert.equal(assertRunRecord(GOLDEN), GOLDEN);
  assert.throws(
    () => assertRunRecord({ ...GOLDEN, schema: "wrong" }),
    (error) => error.name === "AutonomyBenchmarkSchemaError" && error.errors.length > 0,
  );
});

test("unknown top-level keys are rejected", () => {
  const result = validateRunRecord({ ...GOLDEN, surprise: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("record.surprise is not part of the schema"));
});

test("config, kind and timestamp invariants are enforced", () => {
  assert.deepEqual(BENCHMARK_CONFIG_IDS, [
    "opencode-no-wam",
    "wam-task-loop",
    "wam-task-loop-reviewer",
    "wam-full",
  ]);
  assert.ok(BENCHMARK_TASK_KINDS.includes("implementation"));
  assert.equal(BENCHMARK_SCHEMA, "wam.autonomy.benchmark/1");

  const badConfig = validateRunRecord({ ...GOLDEN, configId: "wam-partial" });
  assert.ok(badConfig.errors.some((error) => error.startsWith("record.configId")));

  const reversed = validateRunRecord({ ...GOLDEN, endedAt: "2026-11-02T09:00:00.000Z" });
  assert.ok(reversed.errors.includes("record.endedAt must not precede record.startedAt"));
});

test("metric invariants catch impossible values", () => {
  const result = validateRunRecord({
    ...GOLDEN,
    tokens: { ...GOLDEN.tokens, total: 1 },
    context: { ...GOLDEN.context, relevantTokens: 9999 },
  });
  assert.ok(result.errors.includes("record.tokens.total must be >= input + output"));
  assert.ok(result.errors.includes("record.context.relevantTokens must not exceed injectedTokens"));
});
