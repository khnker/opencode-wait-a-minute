import test from "node:test";
import assert from "node:assert/strict";

import {
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

test("ignores shell-like text inside quotes", () => {
  const sql =
    "docker exec comparador-postgres psql -U comparador -d comparador_serving -At " +
    "-c \"WITH f AS (SELECT 1) SELECT count(*) FROM f WHERE jsonb_array_length(x) >= 2 AND a||b = c;\"";
  assert.equal(isMutatingToolCall("bash", { command: sql }), false);
  assert.equal(isMutatingToolCall("bash", { command: "psql -c 'SELECT cp.id FROM t cp'" }), false);
  assert.equal(isMutatingToolCall("bash", { command: 'echo "rm -rf x > y"' }), false);
  assert.equal(isMutatingToolCall("bash", { command: 'grep -rn "a>b" src' }), false);
});

test("ignores heredoc bodies", () => {
  const command = "psql <<'SQL'\nSELECT 1 WHERE n >= 2;\nSQL";
  assert.equal(isMutatingToolCall("bash", { command }), false);
});

test("blocks real operators, wrappers and nested shells", () => {
  assert.equal(isMutatingToolCall("bash", { command: "echo hi >> f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "echo hi >| f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "sudo rm -f f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "sed -i.bak s/a/b/ f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: "perl -pi -e 's/a/b/' f" }), true);
  assert.equal(isMutatingToolCall("bash", { command: 'bash -c "rm -rf build"' }), true);
  assert.equal(isMutatingToolCall("bash", { command: 'sh -lc "npm install"' }), true);
  assert.equal(isMutatingToolCall("bash", { command: "git stash pop" }), true);
});

test("ignores harmless redirects", () => {
  assert.equal(isMutatingToolCall("bash", { command: "cmd 2>/dev/null" }), false);
  assert.equal(isMutatingToolCall("bash", { command: "cmd 2>&1" }), false);
  assert.equal(isMutatingToolCall("bash", { command: "git stash list" }), false);
});

test("detects an active gate and renders a directive", () => {
  assert.equal(isExecutionGateActive({ executionGate: { active: true } }), true);
  assert.equal(isExecutionGateActive({ executionGate: { active: false } }), false);
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
