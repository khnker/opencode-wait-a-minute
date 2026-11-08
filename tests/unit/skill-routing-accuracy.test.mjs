import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSkillRoutingBenchmark } from "../../benchmarks/real/runners/skill-routing-runner.mjs";
import { SKILL_ROUTING_CORPUS } from "../../benchmarks/scenarios/skill-routing.mjs";
import { discoverSkills } from "../../src/policy/skill-routing.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("skill-routing accuracy on corpus (real pipeline)", async (t) => {
  const available = discoverSkills({ root: REPO });
  const required = [...new Set(SKILL_ROUTING_CORPUS.flatMap((c) => c.expected))];
  const missing = required.filter((id) => !available[id]);
  if (missing.length > 0) {
    t.skip(`requires skills not installed here: ${missing.join(", ")}`);
    return;
  }

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
