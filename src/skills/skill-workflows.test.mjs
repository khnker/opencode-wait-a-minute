import test from "node:test";
import assert from "node:assert/strict";
import {
  STEP_MODIFIERS,
  WORKFLOW_STATUS,
  validateWorkflow,
  createWorkflowState,
  stepWorkflow,
  resumeWorkflow,
  verifyWorkflow,
  selectWorkflow,
} from "./skill-workflows.js";

const wf = (steps, name = "w") => ({ name, steps });

test("modifiers enumerated and steps must reference registered skills", () => {
  assert.deepEqual(STEP_MODIFIERS, ["required", "optional", "conditional", "parallel", "retry", "fallback"]);
  const bad = validateWorkflow(wf([{ skill: "ghost" }]), ["real"]);
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /unknown skill/);
  assert.equal(validateWorkflow(wf([{ skill: "real" }]), ["real"]).ok, true);
});

test("conditional false is skipped and recorded", () => {
  const w = wf([{ skill: "a", condition: "flag" }, { skill: "b" }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { conditions: { flag: false } });
  assert.deepEqual(s.skipped, ["a"]);
  assert.equal(s.cursor, 1);
});

test("optional step that cannot run continues", () => {
  const w = wf([{ skill: "a", optional: true }, { skill: "b" }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { outcomes: {} });
  assert.deepEqual(s.skipped, ["a"]);
  assert.equal(s.status, WORKFLOW_STATUS.RUNNING);
});

test("bounded retries then fallback", () => {
  const w = wf([{ skill: "a", retry: { max: 2 }, fallback: "a_fallback" }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { outcomes: { a: "fail" } });
  s = stepWorkflow(s, w, { outcomes: { a: "fail" } });
  assert.equal(s.retries.a, 2);
  s = stepWorkflow(s, w, { outcomes: { a: "fail" } });
  assert.equal(s.branches[0].fallback, "a_fallback");
  assert.equal(s.cursor, 1);
  assert.equal(s.status, WORKFLOW_STATUS.AWAITING_VERIFICATION);
});

test("retries exhausted without fallback fails explicitly", () => {
  const w = wf([{ skill: "a", retry: { max: 1 } }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { outcomes: { a: "fail" } });
  s = stepWorkflow(s, w, { outcomes: { a: "fail" } });
  assert.equal(s.status, WORKFLOW_STATUS.FAILED);
});

test("resume returns persisted cursor and status", () => {
  const w = wf([{ skill: "a" }, { skill: "b" }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { outcomes: { a: "ok" } });
  const r = resumeWorkflow(s);
  assert.equal(r.cursor, 1);
  assert.equal(r.status, WORKFLOW_STATUS.RUNNING);
});

test("verifiable termination: last step awaits verification, then VERIFIED", () => {
  const w = wf([{ skill: "a" }]);
  let s = createWorkflowState(w);
  s = stepWorkflow(s, w, { outcomes: { a: "ok" } });
  assert.equal(s.status, WORKFLOW_STATUS.AWAITING_VERIFICATION);
  s = verifyWorkflow(s, "evidence:log");
  assert.equal(s.status, WORKFLOW_STATUS.VERIFIED);
  assert.deepEqual(s.evidence, ["evidence:log"]);
});

test("no universal mandatory workflow: selection is opt-in", () => {
  assert.equal(selectWorkflow({ anything: true }), null);
});
