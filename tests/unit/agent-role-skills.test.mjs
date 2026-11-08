import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoleSkills } from "../../src/agents/role-skills.js";
import { describeTaskStage } from "../../src/execution/task-stage.js";

test("loads approved role skills and reports unavailable ones", () => {
  const registry = {
    verify: { status: "APPROVED", content: "Run the verification command before claiming done." },
    "senior-refactor-reviewer": { status: "MISSING", content: "ignored" },
    "github-awesome-copilot-code-review": { status: "AVAILABLE", content: "Review changed lines and evidence." },
  };
  const loaded = resolveRoleSkills("REVIEWER", { registry, root: "/tmp/role-skills" });
  assert.deepEqual(loaded.skills, ["github-awesome-copilot-code-review", "verify"]);
  assert.deepEqual(loaded.missing, ["senior-refactor-reviewer"]);
  assert.match(loaded.text, /### verify/);
  assert.match(loaded.text, /Review changed lines and evidence/);
});

test("returns no text when no preferred skill is available", () => {
  const loaded = resolveRoleSkills("ANALYST", { registry: {}, root: "/tmp/role-skills" });
  assert.equal(loaded.text, "");
  assert.deepEqual(loaded.skills, []);
  assert.ok(loaded.missing.length > 0);
});

test("respects the total prompt budget", () => {
  const registry = {
    verify: { status: "APPROVED", content: "verify-content" },
    "github-awesome-copilot-code-review": { status: "APPROVED", content: "review-content" },
  };
  const loaded = resolveRoleSkills("REVIEWER", {
    registry,
    root: "/tmp/role-skills",
    maxTotalChars: 10,
  });
  assert.deepEqual(loaded.skills, []);
});

test("describes the latest completed role stage", () => {
  const stage = describeTaskStage({
    phase: "IMPLEMENTING",
    agentRun: { results: [{ role: "ANALYST" }, { role: "ARCHITECT" }] },
  });
  assert.equal(stage.index, 2);
  assert.equal(stage.text, "stage: 2/4 strategy");
});

test("reports done only after the task is complete", () => {
  assert.equal(describeTaskStage({ phase: "DONE" }).text, "stage: 4/4 done");
  assert.equal(describeTaskStage({ phase: "PROPOSED" }).text, "stage: 0/4 contract (advisory)");
});
