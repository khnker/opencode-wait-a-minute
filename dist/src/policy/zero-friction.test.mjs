import { test } from "node:test";
import assert from "node:assert/strict";

import { permissionPreflightLines, delegationBlocked, decidePermission } from "./permission-preflight.js";
import { enforceGovernance } from "./governance-enforcement.js";
import { guardAction } from "../execution/runtime-guards.js";

test("zero-friction: permission lines never ask for approval", () => {
  const plan = {
    required: [{ type: "edit", reason: "x" }, { type: "bash", reason: "y" }],
    status: "pending",
  };
  const lines = permissionPreflightLines(plan);
  assert.ok(lines.length > 0);
  assert.doesNotMatch(lines.join("\n"), /Aprobar:/);
  assert.doesNotMatch(lines.join("\n"), /Denegar/);
  assert.match(lines[0], /informativo, no bloquea/);
  assert.equal(decidePermission({ permission: { type: "bash" }, plan }), "allow");
  assert.equal(delegationBlocked({ permissionPreflight: plan }).blocked, false);
});

test("zero-friction: unapproved contract is advisory, not a block", () => {
  const state = {
    phase: "PROPOSED",
    contract: { status: "PROPOSED" },
    requirements: [{ id: "r1", status: "pending" }],
  };
  const decision = enforceGovernance("edit", state, { declaredFiles: ["src/a.js", "src/b.js", "src/c.js"] });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "advisory");
  assert.match(decision.recommendation, /\/wam contract approve/);
  assert.match(decision.recommendation, /Recomendación:/);
  assert.doesNotMatch(decision.recommendation, /GOVERNANCE BLOCK|ESCALATE/);
});

test("zero-friction: uncatalogued tool is advisory", async () => {
  const decision = await guardAction("totally_unknown_tool", {}, "/tmp/opencode/wam-zf", "t1");
  assert.equal(decision.allowed, true);
  assert.equal(decision.level, "ADVISORY");
  assert.match(decision.recommendation, /Recomendación:/);
});

test("zero-friction: hard delete still blocked", async () => {
  const decision = await guardAction("bash", { command: "rm -rf dist" }, "/tmp/opencode/wam-zf", "t1");
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "hard delete forbidden (U1: soft-archive only)");
});

test("zero-friction: delegation tools are safe", async () => {
  const { getEffectiveCapability, CAPABILITY_LEVELS } = await import("./action-capabilities.js");
  assert.equal(getEffectiveCapability("task"), CAPABILITY_LEVELS.SAFE);
  assert.equal(getEffectiveCapability("skill"), CAPABILITY_LEVELS.SAFE);
});
