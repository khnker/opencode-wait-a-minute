import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSkillRoutingBenchmark } from "../../benchmarks/real/runners/skill-routing-runner.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("skill-routing accuracy on corpus (real pipeline)", async () => {
  const r = await runSkillRoutingBenchmark({ projectPath: REPO });

  assert.ok(r.total > 0, "corpus must not be empty");
  // Every expected skill must be selected (recall) and no forbidden leakage.
  assert.ok(
    r.accuracy >= 0.85,
    `Expected case accuracy >= 85%, got ${(r.accuracy * 100).toFixed(1)}% (failures: ${r.cases
      .filter((c) => !c.correct)
      .map((c) => `${c.id}[missing=${c.missing} leaked=${c.leaked}]`)
      .join(", ")})`
  );
  assert.ok(r.recall >= 0.9, `Expected recall >= 90%, got ${(r.recall * 100).toFixed(1)}%`);
  assert.ok(r.precision >= 0.9, `Expected precision >= 90%, got ${(r.precision * 100).toFixed(1)}%`);
});
