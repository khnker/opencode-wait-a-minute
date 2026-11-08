import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { evaluateCompletionInvariants } from "../../src/verification/completion-invariants.js";
import { evaluateCompletionGate } from "../../src/integration/orchestration.js";

function baseState(overrides = {}) {
  return {
    sessionId: "session-a",
    contract: { status: "APPROVED", unknowns: [], assumptions: [], checks: [] },
    completionContract: { criteria: [] },
    requirements: [
      {
        id: "R1",
        title: "demo",
        status: "verified",
        evidence: [
          {
            sessionId: "session-a",
            strength: "L4_VERIFICATION",
            supports: true,
            status: "PASS",
            timestamp: Date.now(),
          },
        ],
      },
    ],
    ...overrides,
  };
}

function outcomeState(overrides = {}) {
  return baseState({
    outcomeContract: {
      taskId: "task-1",
      objective: "demo",
      acceptanceCriteria: [{ id: "c1", description: "demo", mandatory: true }],
    },
    evidence: [{ criterionId: "c1", status: "VERIFIED", timestamp: Date.now() }],
    ...overrides,
  });
}

describe("completion invariants", () => {
  it("fails closed on malformed state", () => {
    for (const state of [null, [], "done", { requirements: "bad" }]) {
      const result = evaluateCompletionInvariants(state);
      assert.equal(result.ok, false);
      assert.ok(result.pending.length > 0);
    }
  });

  it("ignores optional requirements", () => {
    const state = baseState({
      requirements: [
        ...baseState().requirements,
        { id: "R2", title: "optional", optional: true, status: "pending", evidence: [] },
      ],
    });
    assert.equal(evaluateCompletionInvariants(state).ok, true);
  });

  it("requires verified requirements with evidence", () => {
    const pending = evaluateCompletionInvariants(
      baseState({ requirements: [{ id: "R1", title: "demo", status: "pending", evidence: [] }] }),
    );
    assert.equal(pending.ok, false);
    assert.ok(pending.pending.some((item) => item.includes("R1")));

    const missingEvidence = evaluateCompletionInvariants(
      baseState({ requirements: [{ id: "R1", title: "demo", status: "verified", evidence: [] }] }),
    );
    assert.ok(missingEvidence.pending.some((item) => item.includes("sin evidencia")));
  });

  it("rejects cross-session evidence", () => {
    const state = baseState({
      sessionId: "session-b",
    });
    const result = evaluateCompletionInvariants(state);
    assert.equal(result.ok, false);
    assert.ok(result.pending.some((item) => item.includes("cross-session")));
  });

  it("rejects stale and expired evidence", () => {
    const stale = baseState({
      requirements: [
        {
          id: "R1",
          title: "demo",
          status: "verified",
          evidence: [{ stale: true, strength: "L4_VERIFICATION", supports: true }],
        },
      ],
    });
    assert.ok(
      evaluateCompletionInvariants(stale).pending.some((item) => item.includes("stale")),
    );

    const expired = baseState({
      requirements: [
        {
          id: "R1",
          title: "demo",
          status: "verified",
          evidence: [
            {
              sessionId: "session-a",
              timestamp: Date.now() - 60_000,
              strength: "L4_VERIFICATION",
              supports: true,
            },
          ],
        },
      ],
    });
    assert.ok(
      evaluateCompletionInvariants(expired, { now: Date.now(), maxAgeMs: 1_000 })
        .pending.some((item) => item.includes("expired")),
    );
  });

  it("rejects contradictory evidence", () => {
    const state = baseState({
      requirements: [
        {
          id: "R1",
          title: "demo",
          status: "verified",
          evidence: [
            { sessionId: "session-a", strength: "L4_VERIFICATION", supports: true },
            { sessionId: "session-a", strength: "L4_VERIFICATION", supports: false },
          ],
        },
      ],
    });
    const result = evaluateCompletionInvariants(state);
    assert.equal(result.ok, false);
    assert.ok(result.pending.some((item) => item.includes("contradictory")));
  });

  it("requires direct evidence for critical requirements", () => {
    const state = baseState({
      requirements: [
        {
          id: "R1",
          title: "critical",
          critical: true,
          status: "verified",
          evidence: [
            { sessionId: "session-a", strength: "L2_OBSERVATION", supports: true },
          ],
        },
      ],
    });
    const result = evaluateCompletionInvariants(state);
    assert.equal(result.ok, false);
    assert.ok(result.pending.some((item) => item.includes("insufficient evidence strength")));
  });

  it("rejects pending backlog", () => {
    const state = baseState({
      backlog: [{ id: "B1", title: "remaining", status: "pending" }],
    });
    const result = evaluateCompletionInvariants(state);
    assert.equal(result.ok, false);
    assert.ok(result.pending.some((item) => item.includes("backlog")));
  });

  it("preserves the advisory default", () => {
    const gate = evaluateCompletionGate(baseState(), "DONE");
    assert.equal(gate.blocked, false);
    assert.equal(gate.advisory, true);
  });

  it("enforced gate accepts fully verified structured evidence", () => {
    const gate = evaluateCompletionGate(outcomeState(), "DONE", { enforce: true });
    assert.equal(gate.blocked, false);
    assert.equal(gate.allDone, true);
  });

  it("enforced gate blocks cross-session evidence", () => {
    const state = outcomeState({ sessionId: "session-b" });
    const gate = evaluateCompletionGate(state, "DONE", { enforce: true });
    assert.equal(gate.blocked, true);
    assert.ok(gate.pending.some((item) => item.includes("cross-session")));
  });
});
