/**
 * Real-session lifecycle test — multi-turn scenario exercising VALID/STALE/INVALID per turn.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runRealScenario } from "./real-session.mjs";

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "wam-real-"));
}

const fixedProvider = {
  model: "mock",
  async complete({ messages }) {
    return { text: "ok", usage: { inputTokens: 1, outputTokens: 1 } };
  }
};

function baseState() {
  return {
    taskId: "t",
    phase: "PROPOSED",
    contract: { status: "DRAFT", requirements: [] },
    requirements: [],
    nextAction: null
  };
}

test("multi-turn scenario: turn 0 STALE, turns 1-2 VALID, last turn INVALID", async () => {
  const root = mkRoot();
  try {
    const scenario = {
      id: "lifecycle",
      turns: [
        { input: { taskState: baseState() }, prompt: "p0" },
        { input: { taskState: baseState() }, prompt: "p1" },
        { input: { taskState: baseState() }, prompt: "p2" },
        { input: { taskState: { ...baseState(), contract: { status: "APPROVED", requirements: [] } } }, prompt: "p3" }
      ]
    };

    const result = await runRealScenario({
      scenario,
      provider: fixedProvider,
      repoCommit: "deadbeef",
      root
    });

    const turns = result.turns;
    assert.equal(turns.length, 4);

    assert.equal(turns[0].wam.snapshotStatus, "STALE");
    assert.equal(turns[0].wam.fastPath, false);

    assert.equal(turns[1].wam.snapshotStatus, "VALID");
    assert.equal(turns[1].wam.fastPath, true);
    assert.deepEqual(turns[1].wam.changedSignals, []);

    assert.equal(turns[2].wam.snapshotStatus, "VALID");
    assert.equal(turns[2].wam.fastPath, true);
    assert.deepEqual(turns[2].wam.changedSignals, []);

    assert.equal(turns[3].wam.snapshotStatus, "INVALID");
    assert.equal(turns[3].wam.fastPath, false);
    assert.ok(
      Array.isArray(turns[3].wam.changedSignals) && turns[3].wam.changedSignals.includes("task-state"),
        `expected last turn changedSignals includes "task-state", got ${JSON.stringify(turns[3].wam.changedSignals)}`
    );

    // mechanism metadata propagated to the pushed turn
    for (const t of turns) {
      assert.ok(t.mechanism, "mechanism should be present on every turn");
      assert.equal(typeof t.mechanism.snapshotStatus, "string");
      assert.ok(Array.isArray(t.mechanism.changedSignals));
      assert.equal(typeof t.mechanism.fastPath, "boolean");
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});