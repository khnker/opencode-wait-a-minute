import test from "node:test";
import assert from "node:assert/strict";
import {
  SCENARIO_STATES,
  createScenario,
  runPressureScenario,
  comparePressure,
  detectRegression,
  registerScenario,
} from "./skill-pressure.js";

const scenario = createScenario({ name: "s1", input: "do x", expected_behavior: "x done" });

test("scenario requires name/input/expected_behavior", () => {
  assert.throws(() => createScenario({ name: "s" }), /requires/);
  assert.equal(SCENARIO_STATES.includes("REGRESSION"), true);
});

test("pressure scenario scores behavior against expected", async () => {
  const pass = await runPressureScenario(scenario, async () => "x done");
  const fail = await runPressureScenario(scenario, async () => "nope");
  assert.equal(pass.scored, true);
  assert.equal(fail.scored, false);
  assert.deepEqual(pass.evidence, { input: "do x", behavior: "x done" });
});

test("skill VERIFIED only when it beats baseline", async () => {
  const baseline = await runPressureScenario(scenario, async () => "nope");
  const withSkill = await runPressureScenario(scenario, async () => "x done");
  const r = comparePressure(baseline, withSkill, scenario);
  assert.equal(r.demonstrated, true);
  assert.equal(r.status, "VERIFIED");
});

test("no improvement stays UNVERIFIED (baseline already passes)", async () => {
  const baseline = await runPressureScenario(scenario, async () => "x done");
  const withSkill = await runPressureScenario(scenario, async () => "x done");
  const r = comparePressure(baseline, withSkill, scenario);
  assert.equal(r.demonstrated, false);
  assert.equal(r.status, "UNVERIFIED");
});

test("regression detected when a VERIFIED skill stops scoring", () => {
  const r = detectRegression("VERIFIED", { scored: false });
  assert.equal(r.regression, true);
  assert.equal(r.status, "REGRESSION");
  assert.equal(detectRegression("VERIFIED", { scored: true }).regression, false);
});

test("registerScenario appends, never mutates", () => {
  const bench = [];
  const next = registerScenario(scenario, bench);
  assert.equal(bench.length, 0);
  assert.equal(next.length, 1);
});
