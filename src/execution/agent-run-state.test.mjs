import test from "node:test";
import assert from "node:assert/strict";

import {
  agentSignalForLoop,
  carriesSurfaced,
  isTerminalAgentSignal,
  reopenTerminalAgentRun,
  resetAuthorizationSurface,
} from "./agent-run-state.js";

test("agentSignalForLoop returns the fresh outcome when the pass ran", () => {
  const outcome = { status: "COMPLETED", verdict: "ACCEPTED" };
  assert.equal(agentSignalForLoop(outcome, { agentRun: { exhausted: true } }), outcome);
});

test("agentSignalForLoop returns a needs-user marker for an exhausted run", () => {
  const task = {
    agentRun: {
      status: "COMPLETED",
      verdict: "REVISION_REQUIRED",
      exhausted: true,
      surfaced: false,
      results: [{ role: "REVIEWER" }],
    },
  };

  assert.deepEqual(agentSignalForLoop(null, task), {
    status: "COMPLETED",
    verdict: "REVISION_REQUIRED",
    exhausted: true,
    stale: true,
    surfaced: false,
    results: [{ role: "REVIEWER" }],
  });
});

test("agentSignalForLoop marks terminal runs as needing the user", () => {
  for (const status of ["BLOCKED", "NEEDS_INPUT", "FAILED"]) {
    const signal = agentSignalForLoop(null, { agentRun: { status, surfaced: true } });
    assert.equal(signal.status, status);
    assert.equal(signal.exhausted, false);
    assert.equal(signal.surfaced, true);
    assert.equal(isTerminalAgentSignal(signal), true);
  }
});

test("agentSignalForLoop returns null for accepted or healthy runs", () => {
  assert.equal(
    agentSignalForLoop(null, { agentRun: { status: "COMPLETED", verdict: "ACCEPTED" } }),
    null,
  );
  assert.equal(agentSignalForLoop(null, { agentRun: { status: "COMPLETED" } }), null);
  assert.equal(agentSignalForLoop(null, {}), null);
});

test("isTerminalAgentSignal detects exhausted and needs-user runs", () => {
  assert.equal(isTerminalAgentSignal({ exhausted: true }), true);
  assert.equal(isTerminalAgentSignal({ status: "NEEDS_INPUT" }), true);
  assert.equal(isTerminalAgentSignal({ status: "COMPLETED" }), false);
  assert.equal(isTerminalAgentSignal(null), false);
});

test("reopenTerminalAgentRun clears the terminal marker and keeps history", () => {
  const state = {
    agentRun: {
      status: "COMPLETED",
      verdict: "REVISION_REQUIRED",
      stoppedAt: "REVISION_REQUIRED",
      exhausted: true,
      surfaced: true,
      cycles: { revisions: 2, replans: 1 },
      results: [{ role: "REVIEWER" }],
      failureReason: "failed to prompt agent session",
    },
  };

  assert.equal(reopenTerminalAgentRun(state), true);
  assert.equal(state.agentRun.status, null);
  assert.equal(state.agentRun.verdict, null);
  assert.equal(state.agentRun.stoppedAt, null);
  assert.equal(state.agentRun.exhausted, false);
  assert.equal(state.agentRun.surfaced, false);
  assert.equal(state.agentRun.failureReason, undefined);
  assert.deepEqual(state.agentRun.cycles, { revisions: 0, replans: 0 });
  assert.equal(state.agentRun.results.length, 1);
});

test("reopenTerminalAgentRun reopens blocked, needs-input and failed runs", () => {
  for (const status of ["BLOCKED", "NEEDS_INPUT", "FAILED"]) {
    const state = { agentRun: { status, exhausted: false, surfaced: true } };
    assert.equal(reopenTerminalAgentRun(state), true);
    assert.equal(state.agentRun.status, null);
    assert.equal(state.agentRun.surfaced, false);
  }
});

test("reopenTerminalAgentRun is a no-op for healthy or accepted runs", () => {
  const healthy = { agentRun: { exhausted: false, surfaced: true } };
  assert.equal(reopenTerminalAgentRun(healthy), false);
  assert.equal(healthy.agentRun.surfaced, true);

  const accepted = {
    agentRun: { status: "COMPLETED", verdict: "ACCEPTED", exhausted: false, surfaced: true },
  };
  assert.equal(reopenTerminalAgentRun(accepted), false);
  assert.equal(accepted.agentRun.status, "COMPLETED");

  assert.equal(reopenTerminalAgentRun({}), false);
  assert.equal(reopenTerminalAgentRun(null), false);
});

test("resetAuthorizationSurface clears the surfaced authorization marker", () => {
  const state = { authorizationSurfacedId: "auth-1" };
  assert.equal(resetAuthorizationSurface(state), true);
  assert.equal(state.authorizationSurfacedId, null);
  assert.equal(resetAuthorizationSurface(state), false);
  assert.equal(resetAuthorizationSurface(null), false);
});

test("carriesSurfaced only carries the marker for the same terminal signal", () => {
  const previous = { status: "FAILED", failureCode: "PROMPT_FAILED", exhausted: false, surfaced: true };
  assert.equal(carriesSurfaced(previous, { ...previous, surfaced: false }), true);
  assert.equal(
    carriesSurfaced(previous, { ...previous, failureCode: "AGENT_TIMEOUT" }),
    false,
  );
  assert.equal(carriesSurfaced({ ...previous, surfaced: false }, previous), false);
  assert.equal(carriesSurfaced(previous, { status: "COMPLETED", verdict: "ACCEPTED" }), false);
});

test("agentSignalForLoop carries surfaced from a matching persisted run", () => {
  const outcome = { status: "FAILED", stoppedAt: "agent", failureCode: "PROMPT_FAILED" };
  const task = { agentRun: { ...outcome, surfaced: true } };
  const signal = agentSignalForLoop(outcome, task);
  assert.notEqual(signal, outcome);
  assert.equal(signal.surfaced, true);

  const changed = agentSignalForLoop(
    { ...outcome, failureCode: "AGENT_TIMEOUT" },
    task,
  );
  assert.equal(changed.surfaced, undefined);
});

test("reopenTerminalAgentRun resets the failure streak", () => {
  const state = {
    agentRun: { status: "FAILED", exhausted: false, surfaced: true, failureStreak: 3 },
  };
  assert.equal(reopenTerminalAgentRun(state), true);
  assert.equal(state.agentRun.failureStreak, 0);
  assert.equal(state.agentRun.surfaced, false);
});
