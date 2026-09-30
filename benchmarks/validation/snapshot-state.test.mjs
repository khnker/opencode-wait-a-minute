/**
 * snapshot-state validation tests — deterministic snapshot matrix.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SNAPSHOT_MATRIX,
  runSnapshotStateValidation,
  assertNoFalseValid,
} from "./snapshot-state.mjs";

describe("snapshot-state validation", () => {
  it("classifies every matrix case exactly as expected", async () => {
    const results = await runSnapshotStateValidation();
    assert.equal(results.length, SNAPSHOT_MATRIX.length);

    for (const result of results) {
      assert.equal(
        result.pass,
        true,
        [
          `case ${result.caseId}: ${result.description}`,
          `expected ${JSON.stringify(result.expected)}`,
          `actual   ${JSON.stringify(result.actual)}`,
        ].join("\n")
      );
    }
  });

  it("covers VALID, STALE, INVALID, missing and corrupt snapshots", async () => {
    const results = await runSnapshotStateValidation();
    const byId = Object.fromEntries(results.map((r) => [r.caseId, r]));

    assert.equal(byId["no-mutation"].actual.status, "VALID");
    assert.equal(byId["task-mutation"].actual.status, "INVALID");
    assert.equal(byId["snapshot-missing"].actual.status, "STALE");
    assert.equal(byId["snapshot-corrupt"].actual.status, "STALE");
    assert.deepEqual(byId["snapshot-corrupt"].actual.changedSignals, ["no-snapshot"]);
  });

  it("never classifies a mutated context as VALID", async () => {
    const results = await runSnapshotStateValidation();
    assert.equal(assertNoFalseValid(results), true);
  });

  it("records snapshot hits and misses", async () => {
    const results = await runSnapshotStateValidation();
    const hit = results.reduce((sum, r) => sum + r.counters.Snapshot_hit, 0);
    const miss = results.reduce((sum, r) => sum + r.counters.Snapshot_miss, 0);
    const validCases = results.filter((r) => r.actual.status === "VALID").length;
    const nonValidCases = results.length - validCases;

    assert.equal(validCases, 1, "expected exactly one VALID case");
    assert.equal(hit, validCases);
    assert.equal(miss, nonValidCases);
  });

  it("reconstructs context once per non-VALID case and never on the fast path", async () => {
    const results = await runSnapshotStateValidation();
    const nonValid = results.filter((r) => r.actual.status !== "VALID");

    const reconstructed = nonValid.reduce((sum, r) => sum + r.counters.Context_reconstructed, 0);
    const rebuilds = nonValid.reduce((sum, r) => sum + r.counters.Reconstruction_count, 0);
    assert.equal(reconstructed, nonValid.length);
    assert.equal(rebuilds, nonValid.length);

    for (const result of results) {
      if (result.actual.status === "VALID") {
        assert.equal(result.counters.Context_reconstructed, 0);
        assert.equal(result.counters.Reconstruction_count, 0);
      }
    }
  });

  it("gives every non-VALID case a non-empty rebuild scope", async () => {
    const results = await runSnapshotStateValidation();

    for (const result of results) {
      if (result.actual.status === "VALID") continue;
      const { rebuildN1, rebuildN2, rebuildN3 } = result.actual.rebuild;
      assert.equal(
        rebuildN1 || rebuildN2 || rebuildN3,
        true,
        `case ${result.caseId}: rebuild scope is all-false for a ${result.actual.status} context`
      );
    }
  });
});
