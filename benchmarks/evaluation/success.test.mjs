import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTask,
  buildVerificationFromGate
} from "./success.mjs";
import { computeMetrics } from "./metrics.mjs";

test("legacy path (no verification): preserves exact legacy behavior", () => {
  const baseline = { response: "hello world" };
  const wam = { response: "HELLO   world" };
  const r = evaluateTask({ baseline, wam });
  assert.equal(r.correctnessSource, "fallback");
  assert.equal(r.completionAllowed, true);
  assert.equal(r.equivalent, true);
  assert.equal(r.success, true);
  assert.equal(r.testsPassed, true);
  assert.equal(r.filesExpected, true);
  assert.equal(r.verification, null);
});

test("legacy path: non-equivalent responses fail", () => {
  const r = evaluateTask({
    baseline: { response: "alpha" },
    wam: { response: "beta" }
  });
  assert.equal(r.correctnessSource, "fallback");
  assert.equal(r.equivalent, false);
  assert.equal(r.success, false);
});

test("legacy path: empty wam response fails testsPassed", () => {
  const r = evaluateTask({
    baseline: { response: "alpha" },
    wam: { response: "" }
  });
  assert.equal(r.testsPassed, false);
  assert.equal(r.success, false);
});

test("verification:{completionAllowed:true} overrides textual non-equivalence", () => {
  const verification = {
    requirementsTotal: 3,
    requirementsVerified: 3,
    evidenceValid: true,
    blockingAssumptions: 0,
    completionAllowed: true
  };
  const r = evaluateTask({
    baseline: { response: "totally different response A" },
    wam: { response: "completely different response B" },
    expected: { verification }
  });
  assert.equal(r.correctnessSource, "verification");
  assert.equal(r.completionAllowed, true);
  assert.equal(r.equivalent, false);
  assert.equal(r.success, true, "textual equivalence cannot change success when verification says allow");
});

test("verification:{completionAllowed:false} overrides textual equivalence", () => {
  const verification = {
    requirementsTotal: 3,
    requirementsVerified: 1,
    evidenceValid: false,
    blockingAssumptions: 2,
    completionAllowed: false
  };
  const r = evaluateTask({
    baseline: { response: "identical" },
    wam: { response: "identical" },
    expected: { verification }
  });
  assert.equal(r.correctnessSource, "verification");
  assert.equal(r.equivalent, true);
  assert.equal(r.completionAllowed, false);
  assert.equal(r.success, false, "verification disallow cannot be overridden by textual equivalence");
});

test("buildVerificationFromGate: full success", () => {
  const gate = {
    allowed: true,
    reason: "all requirements satisfied",
    blockers: [],
    summary: { total: 3, complete: 3, incomplete: 0, blocked: 0 }
  };
  const v = buildVerificationFromGate(gate);
  assert.deepEqual(v, {
    requirementsTotal: 3,
    requirementsVerified: 3,
    evidenceValid: true,
    blockingAssumptions: 0,
    completionAllowed: true
  });
});

test("buildVerificationFromGate: blocker with 'evidence' reason => evidenceValid:false", () => {
  const gate = {
    allowed: false,
    reason: "blocked",
    blockers: [
      { requirementId: "r1", reason: "Missing evidence for step 2" }
    ],
    summary: { total: 3, complete: 1, incomplete: 1, blocked: 1 }
  };
  const v = buildVerificationFromGate(gate);
  assert.equal(v.requirementsTotal, 3);
  assert.equal(v.requirementsVerified, 1);
  assert.equal(v.evidenceValid, false);
  assert.equal(v.blockingAssumptions, 1);
  assert.equal(v.completionAllowed, false);
});

test("buildVerificationFromGate: defensive null/malformed inputs", () => {
  assert.equal(buildVerificationFromGate(null).completionAllowed, false);
  assert.equal(buildVerificationFromGate(undefined).completionAllowed, false);
  assert.equal(buildVerificationFromGate({}).completionAllowed, false);
  assert.equal(buildVerificationFromGate("garbage").completionAllowed, false);
  assert.equal(buildVerificationFromGate({ allowed: true }).completionAllowed, false);
});

test("computeMetrics: VerificationRate and correctnessSource breakdown", () => {
  const evaluations = [
    // 1 verification-success
    {
      success: true,
      equivalent: false,
      correctnessSource: "verification",
      completionAllowed: true
    },
    // 1 fallback-fail
    {
      success: false,
      equivalent: false,
      correctnessSource: "fallback",
      completionAllowed: false
    }
  ];
  const results = [
    { turns: [{}], totals: { wamTokens: 0, baselineTokens: 0 }, counters: {} }
  ];
  const m = computeMetrics({ results, evaluations });
  assert.equal(m.VerificationRate, 50);
  assert.deepEqual(m.correctnessSource, { verification: 1, fallback: 1 });
});

test("computeMetrics: keeps legacy metrics intact", () => {
  const evaluations = [
    { success: true, equivalent: true, correctnessSource: "fallback", completionAllowed: true }
  ];
  const results = [
    { turns: [{}, {}], totals: { wamTokens: 50, baselineTokens: 100 }, counters: { Context_fast_path: 1 } }
  ];
  const m = computeMetrics({ results, evaluations });
  assert.equal(m.SuccessfulTasks, 1);
  assert.equal(m.SuccessRate, 100);
  assert.equal(m.EquivalenceRate, 100);
  assert.equal(m.FastPathRate, 50);
  assert.equal(m.context_reduction, 50);
  assert.equal(m.wam_overhead, 0);
  assert.equal(m.net_input_savings, 50);
  assert.equal(typeof m.VerificationRate, "number");
  assert.deepEqual(m.correctnessSource, { verification: 0, fallback: 1 });
});