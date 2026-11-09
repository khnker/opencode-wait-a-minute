import test from "node:test";
import assert from "node:assert/strict";

import {
  executionGateDirective,
  isExecutionGateActive,
  isExecutionGateStale,
  isMutatingToolCall,
  shouldClearExecutionGate,
  shouldReleaseOrphanGate,
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

test("treats gates owned by another process (or legacy gates) as stale", () => {
  assert.equal(isExecutionGateStale({ active: true, ownerPid: 123, startedAt: new Date().toISOString() }, 123), false);
  assert.equal(isExecutionGateStale({ active: true, ownerPid: 122 }, 123), true);
  assert.equal(isExecutionGateStale({ active: true }, 123), true);
  assert.equal(isExecutionGateStale({ active: false, ownerPid: 122 }, 123), false);
  assert.equal(isExecutionGateStale(null, 123), false);
});

test("releases an orphan gate only when its loop is terminal and nothing is in flight", () => {
  const active = { executionGate: { active: true, ownerPid: process.pid } };
  assert.equal(shouldReleaseOrphanGate(active, { loopStatus: "STOPPED" }), true);
  assert.equal(shouldReleaseOrphanGate(active, { loopStatus: "COMPLETED" }), true);
  assert.equal(shouldReleaseOrphanGate(active, { loopStatus: "RUNNING" }), false);
  assert.equal(shouldReleaseOrphanGate(active, { loopStatus: null }), false);
  assert.equal(shouldReleaseOrphanGate(active, { loopStatus: "STOPPED", inFlight: true }), false);
  assert.equal(shouldReleaseOrphanGate({ executionGate: { active: false } }, { loopStatus: "STOPPED" }), false);
  assert.equal(shouldReleaseOrphanGate(null, { loopStatus: "STOPPED" }), false);
});

test("marks an expired same-pid gate as stale", () => {
  const startedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid, startedAt }), true);
});

test("keeps a fresh same-pid gate active", () => {
  const startedAt = new Date().toISOString();
  assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid, startedAt }), false);
});

test("honours WAM_EXECUTION_GATE_TTL_MS override", () => {
  const previous = process.env.WAM_EXECUTION_GATE_TTL_MS;
  try {
    process.env.WAM_EXECUTION_GATE_TTL_MS = "1000";
    const expired = new Date(Date.now() - 2000).toISOString();
    const fresh = new Date().toISOString();
    assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid, startedAt: expired }), true);
    assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid, startedAt: fresh }), false);
  } finally {
    if (previous === undefined) delete process.env.WAM_EXECUTION_GATE_TTL_MS;
    else process.env.WAM_EXECUTION_GATE_TTL_MS = previous;
  }
});

test("marks an active same-pid gate without a valid timestamp as stale", () => {
  assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid }), true);
  assert.equal(isExecutionGateStale({ active: true, ownerPid: process.pid, startedAt: "not-a-date" }), true);
});

test("does not mark an inactive gate as stale", () => {
  assert.equal(isExecutionGateStale({ active: false, ownerPid: process.pid }), false);
  assert.equal(
    isExecutionGateStale({ active: false, ownerPid: process.pid, startedAt: new Date(0).toISOString() }),
    false,
  );
});
