import test from "node:test";
import assert from "node:assert/strict";
import { stableStringify, logicalStateHash, assertEquivalentState } from "./state-equivalence.mjs";
import { normalizeRuns, buildRealReport } from "./compare-runs.mjs";

test("stableStringify handles key order", () => {
  const o1 = { b: 1, a: 2 };
  const o2 = { a: 2, b: 1 };
  assert.equal(stableStringify(o1), stableStringify(o2));
});

test("logicalStateHash consistency", () => {
  const i1 = { a: 1 };
  const i2 = { a: 2 };
  assert.notEqual(logicalStateHash(i1), logicalStateHash(i2));
  assert.equal(logicalStateHash(i1), logicalStateHash({ a: 1 }));
});

test("assertEquivalentState throws on mismatch", () => {
  assert.doesNotThrow(() => assertEquivalentState({ baselineHash: "a", wamHash: "a" }));
  assert.throws(() => assertEquivalentState({ baselineHash: "a", wamHash: "b" }), /state mismatch/);
});

const makeSession = (baselineHash, wamHash, stateEquivalentFlag = true) => ({
  scenarioId: "test-scenario",
  repoCommit: "abc123",
  stateEquivalent: stateEquivalentFlag,
  turns: [{
    turnIndex: 0,
    baseline: {
      arm: "baseline",
      scenarioId: "test-scenario",
      turnIndex: 0,
      repoCommit: "abc123",
      model: "m",
      prompt: "p",
      response: "br",
      usage: { inputTokens: 100, outputTokens: 50 },
      logicalStateHash: baselineHash
    },
    wam: {
      arm: "wam",
      scenarioId: "test-scenario",
      turnIndex: 0,
      repoCommit: "abc123",
      model: "m",
      prompt: "p2",
      response: "wr",
      usage: { inputTokens: 30, outputTokens: 50 },
      counters: { Context_fast_path: 0, Reconstruction_count: 1 },
      levels: [],
      logicalStateHash: wamHash
    },
    stateEquivalent: stateEquivalentFlag
  }],
  totals: { baselineTokens: 150, wamTokens: 80, baselineOutput: 50, wamOutput: 50 },
  counters: {}
});

test("normalizeRuns with matching hashes yields stateEquivalent:true", () => {
  const hash = "abc123";
  const session = makeSession(hash, hash);
  const runs = normalizeRuns(session, { model: "m", provider: "p" });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].stateEquivalent, true);
  assert.ok(runs[0].logicalStateHash && runs[0].logicalStateHash.length > 0);
  assert.equal(runs[0].logicalStateHash, hash);
});

test("normalizeRuns with mismatched hashes yields stateEquivalent:false", () => {
  const session = makeSession("aaa", "bbb", false);
  const runs = normalizeRuns(session, { model: "m", provider: "p" });
  assert.equal(runs[0].stateEquivalent, false);
});

test("buildRealReport benchmarkValid reflects state equivalence", () => {
  const matching = buildRealReport({ sessionResults: [makeSession("h", "h")], model: "m", provider: "p" });
  assert.equal(matching.benchmarkValid, true);

  const mismatched = buildRealReport({ sessionResults: [makeSession("a", "b", false)], model: "m", provider: "p" });
  assert.equal(mismatched.benchmarkValid, false);
});

