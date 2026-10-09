import test from "node:test";
import assert from "node:assert/strict";
import {
  VERIFICATION_METHODS,
  CLAIM_STATES,
  isValidMethod,
  createClaim,
  verifyWithMethod,
  isCompletionToken,
  guardCompletion,
} from "./claim-completion.js";

test("method enum is closed and complete", () => {
  assert.deepEqual(VERIFICATION_METHODS, ["automated", "observational", "external_evidence", "human_confirmation"]);
  assert.equal(isValidMethod("automated"), true);
  assert.equal(isValidMethod("vibes"), false);
});

test("claim state model distinguishes all five states", () => {
  assert.deepEqual(Object.keys(CLAIM_STATES).sort(), ["CLAIMED", "FAILED", "SUPPORTED", "UNKNOWN", "VERIFIED"]);
});

test("reason-only completion is UNKNOWN", () => {
  const c = createClaim("I think it works");
  assert.equal(c.state, CLAIM_STATES.UNKNOWN);
  assert.equal(c.reason, "missing_or_invalid_method");
});

test("missing method downgrades to UNKNOWN even with evidence", () => {
  const c = createClaim("done", { evidence: "log" });
  assert.equal(c.state, CLAIM_STATES.UNKNOWN);
});

test("verified with evidence", () => {
  const c = createClaim("done", { method: "automated", evidence: "test run: 20/20" });
  assert.equal(c.state, CLAIM_STATES.VERIFIED);
});

test("failed when verification contradicts", () => {
  const c = verifyWithMethod(createClaim("done", { method: "automated" }), { method: "automated", evidence: "x", contradicts: true });
  assert.equal(c.state, CLAIM_STATES.FAILED);
});

test("observational method with captured observation reaches VERIFIED", () => {
  const c = createClaim("done", { method: "observational", observation: "saw output" });
  assert.equal(c.state, CLAIM_STATES.VERIFIED);
});

test("completion tokens are blocked unless VERIFIED", () => {
  assert.equal(isCompletionToken("TASK DONE"), true);
  assert.equal(isCompletionToken("all good"), false);
  const blocked = guardCompletion("DONE", createClaim("x"));
  assert.equal(blocked.blocked, true);
  const allowed = guardCompletion("DONE", createClaim("x", { method: "automated", evidence: "log" }));
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.blocked, false);
});
