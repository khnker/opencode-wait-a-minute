import test from "node:test";
import assert from "node:assert/strict";

import {
  executionGateDirective,
  isExecutionGateActive,
  isMutatingToolCall,
  shouldClearExecutionGate,
} from "../../src/execution/execution-gate.js";

test("blocks native mutation tools", () => {
  for (const tool of ["write", "edit", "patch", "multiedit", "apply_patch"]) {
    assert.equal(isMutatingToolCall(tool, {}), true, tool);
  }
});

test("allows read-only tools and commands", () => {
  assert.equal(isMutatingToolCall("read", {}), false);
  assert.equal(isMutatingToolCall("bash", { command: "git status" }), false);
  assert.equal(isMutatingToolCall("bash", { command: "git diff" }), false);
  assert.equal(isMutatingToolCall("bash", { command: "node --test x.mjs" }), false);
});

test("blocks mutating shell commands", () => {
  assert.equal(isMutatingToolCall("bash", { command: "sed -i s/a/b/ f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "echo hi > f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "git commit -m x" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "rm -f f" }), true);
});

test("detects an active gate and renders a directive", () => {
  assert.equal(isExecutionGateActive({ executionGate: { active: true } }), true);
  assert.equal(isExecutionGateActive({ executionGate: { active: false } }), false);
  assert.match(
    executionGateDirective({ reason: "analysis-loop" }),
    /pipeline de análisis read-only/,
  );
  assert.match(executionGateDirective({ reason: "agent-loop" }), /loop de agentes/);
});

test("clears an active gate only when no pass is in flight", () => {
  const active = { executionGate: { active: true } };
  assert.equal(shouldClearExecutionGate(active, false), true);
  assert.equal(shouldClearExecutionGate(active, true), false);
  assert.equal(shouldClearExecutionGate({ executionGate: { active: false } }, false), false);
  assert.equal(shouldClearExecutionGate(null, false), false);
});
