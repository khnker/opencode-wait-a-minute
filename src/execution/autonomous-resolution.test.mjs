import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAutonomousResolution, mustResolveAutonomously, AUTONOMOUS_RESOLUTION_MODES } from "./autonomous-resolution.js";

test("passed status returns noop", () => {
  const result = evaluateAutonomousResolution({ status: "passed", checkId: "t1" }, {});
  assert.equal(result.mode, "noop");
  assert.equal(result.required, false);
});

test("failed status without opt-out returns resolve", () => {
  const result = evaluateAutonomousResolution({ status: "failed", checkId: "api", reason: "timeout" }, {});
  assert.equal(result.mode, "resolve");
  assert.equal(result.required, true);
  assert.ok(result.reason.includes("api"));
  assert.ok(result.directive.includes("fix"));
});

test("failed status with explicit opt-out returns escalate", () => {
  const result = evaluateAutonomousResolution(
    { status: "failed", checkId: "api", reason: "timeout" },
    { explicitOptOut: true, optOutReason: "user said no" }
  );
  assert.equal(result.mode, "escalate");
  assert.equal(result.required, true);
  assert.ok(result.reason.includes("user said no"));
});

test("missing status returns escalate", () => {
  const result = evaluateAutonomousResolution({}, {});
  assert.equal(result.mode, "escalate");
  assert.equal(result.required, true);
});

test("mustResolveAutonomously true for failed", () => {
  assert.equal(mustResolveAutonomously("failed", false), true);
});

test("mustResolveAutonomously false for passed without problem", () => {
  assert.equal(mustResolveAutonomously("passed", false), false);
});

test("mustResolveAutonomously true for passed with problem", () => {
  assert.equal(mustResolveAutonomously("passed", true), true);
});

test("mustResolveAutonomously true for error", () => {
  assert.equal(mustResolveAutonomously("error", false), true);
});

test("modes are frozen", () => {
  assert.equal(Object.isFrozen(AUTONOMOUS_RESOLUTION_MODES), true);
});

test("directive contains root cause analysis instruction", () => {
  const result = evaluateAutonomousResolution({ status: "failed", checkId: "db" }, {});
  assert.ok(result.directive.includes("root cause"));
});
