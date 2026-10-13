import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBaseline, serializeBaseline } from "./freeze-baseline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASELINES_DIR = path.join(HERE, "baselines");

describe("frozen baseline is reproducible (PQ-EXP-05)", () => {
  it("serializes byte-identically across repeated builds and is timestamp-free", () => {
    const first = serializeBaseline(buildBaseline());
    const second = serializeBaseline(buildBaseline());
    assert.strictEqual(first, second);
    assert.equal(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(first), false, "baseline must not embed a timestamp");
  });

  it("matches the committed baselines/core.json byte-for-byte", () => {
    const onDisk = fs.readFileSync(path.join(BASELINES_DIR, "core.json"), "utf8");
    assert.strictEqual(onDisk, serializeBaseline(buildBaseline()));
  });

  it("records suite id/version, config hash, coverage hash and metrics", () => {
    const baseline = buildBaseline();
    assert.strictEqual(baseline.schema, "wam.prompt-eval.baseline/1");
    assert.strictEqual(baseline.suite.id, "core");
    assert.match(baseline.suite.version, /^\d+\.\d+\.\d+$/);
    assert.match(baseline.suite.hash, /^[0-9a-f]{64}$/);
    assert.match(baseline.configHash, /^[0-9a-f]{64}$/);
    assert.match(baseline.coverage.hash, /^[0-9a-f]{64}$/);
    assert.ok(baseline.coverage.scenarios.length >= 4);
    assert.ok(baseline.coverage.requiredCriteria.length >= 4);
    assert.equal(typeof baseline.metrics.mandatoryCompliance, "number");
    assert.equal(typeof baseline.metrics.criticalRegressions, "number");
  });

  it("ships an on-disk baseline for every suite", () => {
    for (const suite of ["verify", "scope", "simplify", "delegation", "core"]) {
      const file = path.join(BASELINES_DIR, `${suite}.json`);
      assert.ok(fs.existsSync(file), `missing baseline ${suite}.json`);
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.strictEqual(parsed.schema, "wam.prompt-eval.baseline/1");
    }
  });
});
