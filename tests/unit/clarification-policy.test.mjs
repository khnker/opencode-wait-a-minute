import test from "node:test";
import assert from "node:assert/strict";

import { decideClarification, CLARIFICATION } from "../../src/policy/clarification-policy.js";

test("non-critical decisions are assumed", () => {
  assert.equal(decideClarification({ classification: "NON_BLOCKING" }).decision, CLARIFICATION.ASSUME);
});

test("resolved decisions use the historical answer", () => {
  const result = decideClarification({
    classification: "DECISION_CRITICAL",
    historyAnswer: "soft delete",
    risk: "destructive",
  });
  assert.equal(result.decision, CLARIFICATION.ASSUME);
  assert.equal(result.answer, "soft delete");
});

test("high-risk unresolved decisions are asked", () => {
  assert.equal(
    decideClarification({ classification: "DECISION_CRITICAL", risk: "destructive" }).decision,
    CLARIFICATION.ASK
  );
});

test("low-risk unresolved decisions are assumed", () => {
  assert.equal(
    decideClarification({ classification: "DECISION_CRITICAL", risk: "low" }).decision,
    CLARIFICATION.ASSUME
  );
});
