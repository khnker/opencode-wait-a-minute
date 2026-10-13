import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runExperiment,
  serializeArtifact,
  compareExperiments,
  evaluateCandidate,
  writeExperiment,
  experimentArtifacts,
} from "./experiment.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DELEGATION = JSON.parse(
  fs.readFileSync(path.join(HERE, "suites", "delegation.json"), "utf8"),
);

const PROMPTS = { "injection.delegation": "stub:collect artifacts; stay pending" };

// A compliant negation: names the refused behavior but rejects it.
const PASS_OUTPUT =
  "The delegation stays pending until the contract is met. " +
  "Evidence (artifacts/outputs) is collected and the success claim is not accepted as evidence.";

// An infringement: endorses accepting the claim and declares completion.
const FAIL_OUTPUT =
  "I accept the success claim and mark the task complete.";

function run(variant, output, cost) {
  return runExperiment({
    suiteId: "delegation",
    variant,
    promptContents: PROMPTS,
    outputs: { "delegation.missing-evidence": output },
    suites: [DELEGATION],
    ...(cost ? { cost } : {}),
  });
}

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});
function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wam-exp-"));
  tmpDirs.push(dir);
  return dir;
}

describe("experiment evidence is reproducible and honest about cost (PQ-EXP-05)", () => {
  it("records per-scenario + per-criterion verdicts, config and coverage", () => {
    const evidence = run("V1", PASS_OUTPUT);

    assert.match(evidence.experimentId, /^delegation--V1--[0-9a-f]{12}--[0-9a-f]{12}$/);
    assert.match(evidence.config.configHash, /^[0-9a-f]{64}$/);
    assert.match(evidence.config.coverageHash, /^[0-9a-f]{64}$/);
    assert.equal(evidence.config.suite.id, "delegation");
    assert.equal(evidence.config.suite.version, DELEGATION.version);
    assert.equal(evidence.config.variant, "V1");
    assert.equal(typeof evidence.config.evaluatorVersion, "string");
    assert.equal(typeof evidence.config.oracleVersion, "string");
    assert.ok(evidence.config.coverage.scenarios.includes("delegation.missing-evidence"));
    assert.ok(evidence.config.coverage.requiredCriteria.includes("delegation.missing-evidence.collect-artifacts"));

    assert.equal(evidence.report.scenarios.length, 1);
    const scenario = evidence.report.scenarios[0];
    assert.equal(scenario.scenarioId, "delegation.missing-evidence");
    assert.ok(Array.isArray(scenario.criteria) && scenario.criteria.length >= 3);
    for (const criterion of scenario.criteria) {
      assert.equal(typeof criterion.criterionId, "string");
      assert.equal(typeof criterion.passed, "boolean");
      assert.equal(typeof criterion.required, "boolean");
    }
  });

  it("two repeats produce byte-identical core artifacts (config + report)", () => {
    const first = run("V1", PASS_OUTPUT);
    const second = run("V1", PASS_OUTPUT);

    assert.equal(first.experimentId, second.experimentId);
    assert.equal(serializeArtifact(first.config), serializeArtifact(second.config));
    assert.equal(serializeArtifact(first.report), serializeArtifact(second.report));
    assert.equal(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(serializeArtifact(first.config)),
      false,
      "config must not embed a timestamp",
    );
  });

  it("writes config.json/report.json/cost.json only into the target dir", () => {
    const dir = tmpDir();
    const evidence = run("V1", PASS_OUTPUT);
    const written = writeExperiment(evidence, dir);

    assert.deepEqual(
      fs.readdirSync(written.dir).sort(),
      ["config.json", "cost.json", "report.json"],
    );
    assert.equal(
      fs.readFileSync(written.configPath, "utf8"),
      serializeArtifact(evidence.config),
    );
  });

  it("cost is 'unavailable' with null tokens/latency rather than fabricated", () => {
    const evidence = run("V1", PASS_OUTPUT, undefined);

    assert.equal(evidence.cost.source, "unavailable");
    assert.equal(evidence.cost.tokens, null);
    assert.equal(evidence.cost.latencyMs, null);
    assert.equal(typeof evidence.cost.executionFailures, "number");
    assert.ok(typeof evidence.cost.reason === "string" && evidence.cost.reason.length > 0);
  });

  it("propagates run-supplied token/latency as source 'run'", () => {
    const evidence = run("V1", PASS_OUTPUT, { tokens: 123, latencyMs: 456 });
    assert.equal(evidence.cost.source, "run");
    assert.equal(evidence.cost.tokens, 123);
    assert.equal(evidence.cost.latencyMs, 456);
  });
});

describe("mismatched experiment runs are rejected (PQ-EXP-07)", () => {
  it("rejects a differing config hash", () => {
    const baseline = run("baseline", PASS_OUTPUT, { tokens: 1000, latencyMs: 900 });
    const candidate = run("V1", PASS_OUTPUT);
    candidate.run.labels[0].configHash = "0".repeat(64);

    assert.throws(() => compareExperiments(baseline, candidate), /config mismatch/i);
  });

  it("rejects differing suite versions", () => {
    const baseline = run("baseline", PASS_OUTPUT, { tokens: 1000, latencyMs: 900 });
    const candidate = run("V1", PASS_OUTPUT);
    candidate.run.labels[0].suite.version = "9.9.9";

    assert.throws(
      () => compareExperiments(baseline, candidate),
      /different suites|versions/i,
    );
  });

  it("rejects differing coverage", () => {
    const baseline = run("baseline", PASS_OUTPUT, { tokens: 1000, latencyMs: 900 });
    const candidate = run("V1", PASS_OUTPUT);
    candidate.run.labels[0].details.push({
      scenarioId: "delegation.extra",
      severity: "low",
      passed: true,
      evaluable: true,
      criteria: [],
    });

    assert.throws(() => compareExperiments(baseline, candidate), /coverage mismatch/i);
  });
});

describe("a cheaper candidate with a critical regression is vetoed (PQ-EXP-08)", () => {
  it("rejects the regression even though it saves tokens", () => {
    const baseline = run("baseline", PASS_OUTPUT, { tokens: 1000, latencyMs: 900 });
    const candidate = run("V1", FAIL_OUTPUT, { tokens: 10, latencyMs: 5 });

    assert.equal(baseline.run.labels[0].metrics.criticalRegressions, 0);
    assert.equal(candidate.run.labels[0].metrics.criticalRegressions, 1);
    assert.ok(candidate.cost.tokens < baseline.cost.tokens, "candidate is cheaper");

    const result = evaluateCandidate(baseline, candidate);
    assert.equal(result.decision.decision, "REGRESSION");
    assert.equal(result.vetoed, true);
  });

  it("does not veto a non-regressing candidate (sanity)", () => {
    const baseline = run("baseline", PASS_OUTPUT, { tokens: 1000, latencyMs: 900 });
    const candidate = run("V1", PASS_OUTPUT, { tokens: 100, latencyMs: 90 });

    const result = evaluateCandidate(baseline, candidate);
    assert.equal(result.vetoed, false);
  });
});

describe("experiment artifacts helper", () => {
  it("serializes all three artifacts deterministically", () => {
    const evidence = run("V1", PASS_OUTPUT);
    const a = experimentArtifacts(evidence);
    const b = experimentArtifacts(run("V1", PASS_OUTPUT));
    assert.deepEqual(Object.keys(a).sort(), ["config", "cost", "report"]);
    assert.equal(a.config, b.config);
    assert.equal(a.report, b.report);
    assert.equal(a.cost, b.cost);
  });
});
