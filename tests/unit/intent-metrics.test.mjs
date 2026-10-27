import test from "node:test";
import assert from "node:assert/strict";

import {
  intentAccuracy,
  clarificationRate,
  contractAcceptanceRate,
  averageContextTokens,
  evaluateIntentSuite,
} from "../../benchmarks/evaluation/intent-metrics.mjs";

test("intent accuracy counts matches", () => {
  assert.equal(
    intentAccuracy([
      { expected: "TASK_NEW", actual: "TASK_NEW" },
      { expected: "CONVERSATION", actual: "TASK_NEW" },
    ]),
    0.5
  );
});

test("clarification and contract rates", () => {
  assert.equal(clarificationRate([{ asked: true }, { asked: false }]), 0.5);
  assert.equal(contractAcceptanceRate([{ accepted: true }, { accepted: false }]), 0.5);
});

test("average context tokens", () => {
  assert.equal(averageContextTokens([{ tokens: 100 }, { tokens: 300 }]), 200);
});

test("suite aggregates all metrics", () => {
  const report = evaluateIntentSuite({
    lanes: [{ expected: "TASK_NEW", actual: "TASK_NEW" }],
    clarifications: [{ asked: false }],
    contracts: [{ accepted: true }],
    contexts: [{ tokens: 500 }],
  });
  assert.equal(report.intentAccuracy, 1);
  assert.equal(report.clarificationRate, 0);
  assert.equal(report.contractAcceptanceRate, 1);
  assert.equal(report.averageContextTokens, 500);
});
