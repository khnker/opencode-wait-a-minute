import test from "node:test";
import assert from "node:assert/strict";
import { FALSE_COMPLETION_SCENARIOS } from "../../benchmarks/scenarios/false-completion.mjs";
import { evaluateScenario } from "../../benchmarks/real/runners/false-completion-runner.mjs";

for (const scenario of FALSE_COMPLETION_SCENARIOS) {
  test(`false-completion scenario ${scenario.id}: WAM blocks premature completion`, async () => {
    const result = await evaluateScenario(scenario);
    assert.equal(result.wamFalseCompletion, 0, `WAM should block false completion for scenario ${scenario.id}`);
    assert.equal(result.gateBlocked, true, `Gate should be blocked for scenario ${scenario.id}`);
  });
}

import { runFalseCompletionBenchmark } from "../../benchmarks/real/runners/false-completion-runner.mjs";
test("false-completion benchmark: WAM blocks 100% of premature completions while baseline accepts at least one", async () => {
  const { report } = await runFalseCompletionBenchmark();

  for (const s of report.scenarios) {
    assert.equal(s.wamFalseCompletion, 0, `Scenario ${s.id}: WAM must block false completion`);
  }

  assert.ok(report.totals.baselineFalseCompletion > 0, "Baseline must accept at least one false completion to prove discrimination");
  assert.equal(report.totals.wamFalseCompletion, 0, "WAM must prevent 100% of premature completions");
});
