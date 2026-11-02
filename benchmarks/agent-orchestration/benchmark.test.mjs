import test from "node:test";
import assert from "node:assert/strict";

import { runAgentOrchestrationBenchmark } from "./index.mjs";

function recordFor(records, id) {
  const record = records.find((entry) => entry.scenario === id);
  assert.ok(record, `missing scenario ${id}`);
  return record;
}

test("benchmark records all scenarios deterministically", async () => {
  const first = await runAgentOrchestrationBenchmark();
  const second = await runAgentOrchestrationBenchmark();

  assert.equal(first.benchmark, "agent-orchestration");
  assert.equal(first.records.length, 4);
  assert.deepEqual(first, second);
});

test("accepted first pass runs four roles without feedback", async () => {
  const { records } = await runAgentOrchestrationBenchmark();
  const { feedback, baseline } = recordFor(records, "accepted-first-pass");

  assert.deepEqual(feedback.invocations.byRole, {
    ANALYST: 1,
    ARCHITECT: 1,
    BUILDER: 1,
    REVIEWER: 1,
  });
  assert.equal(feedback.invocations.total, 4);
  assert.deepEqual(feedback.cycles, { revisions: 0, replans: 0 });
  assert.equal(feedback.accepted, true);
  assert.equal(feedback.exhausted, false);
  assert.equal(feedback.defectResolved, true);
  assert.equal(baseline.invocations.total, 1);
  assert.equal(baseline.falseAccept, false);
});

test("revision catches the injected defect and resolves it", async () => {
  const { records } = await runAgentOrchestrationBenchmark();
  const { feedback, baseline } = recordFor(records, "revision-accepted");

  assert.equal(baseline.invocations.total, 1);
  assert.equal(baseline.accepted, true);
  assert.equal(baseline.falseAccept, true);
  assert.equal(baseline.defectResolved, false);

  assert.deepEqual(feedback.invocations.byRole, {
    ANALYST: 1,
    ARCHITECT: 1,
    BUILDER: 2,
    REVIEWER: 2,
  });
  assert.deepEqual(feedback.cycles, { revisions: 1, replans: 0 });
  assert.equal(feedback.findingsCaught, 1);
  assert.equal(feedback.accepted, true);
  assert.equal(feedback.defectResolved, true);
});

test("replan catches the design defect and resolves it", async () => {
  const { records } = await runAgentOrchestrationBenchmark();
  const { feedback } = recordFor(records, "replan-accepted");

  assert.deepEqual(feedback.invocations.byRole, {
    ANALYST: 1,
    ARCHITECT: 2,
    BUILDER: 2,
    REVIEWER: 2,
  });
  assert.deepEqual(feedback.cycles, { revisions: 0, replans: 1 });
  assert.equal(feedback.findingsCaught, 1);
  assert.equal(feedback.accepted, true);
  assert.equal(feedback.defectResolved, true);
});

test("exhausted feedback stops without an accepted result", async () => {
  const { records } = await runAgentOrchestrationBenchmark();
  const { feedback } = recordFor(records, "exhausted");

  assert.equal(feedback.invocations.total, 4);
  assert.equal(feedback.exhausted, true);
  assert.equal(feedback.accepted, false);
  assert.equal(feedback.findingsCaught, 1);
  assert.equal(feedback.defectResolved, false);
  assert.equal(feedback.stoppedAt, "REVIEWER");
});
