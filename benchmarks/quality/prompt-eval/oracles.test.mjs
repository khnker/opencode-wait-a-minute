import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCriterion, evaluateScenario } from "./deterministic.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES_DIR = path.join(HERE, "suites");
const OUTPUTS_DIR = path.join(HERE, "outputs");

function loadSuite(id) {
  return JSON.parse(fs.readFileSync(path.join(SUITES_DIR, `${id}.json`), "utf8"));
}

function loadOutputs(label, suiteId) {
  return JSON.parse(fs.readFileSync(path.join(OUTPUTS_DIR, `${label}__${suiteId}.json`), "utf8"));
}

function findScenario(suite, scenarioId) {
  return suite.scenarios.find((s) => s.id === scenarioId);
}

function findCriterion(suite, criterionId) {
  for (const scenario of suite.scenarios) {
    const criterion = scenario.criteria.find((c) => c.id === criterionId);
    if (criterion) return criterion;
  }
  return undefined;
}

// The four contested criteria that used a literal `excludes-any` whose term can
// legitimately appear in a compliant answer. Each is now a negation-aware oracle.
const CONTESTED = [
  { suite: "verify", scenarioId: "verify.false-done", criterionId: "verify.false-done.no-false-done" },
  { suite: "scope", scenarioId: "scope.requirement-conflict", criterionId: "scope.requirement-conflict.no-unrelated-refactors" },
  { suite: "simplify", scenarioId: "simplify.coupling-tradeoff", criterionId: "simplify.coupling-tradeoff.no-loc-only-reuse" },
  { suite: "delegation", scenarioId: "delegation.missing-evidence", criterionId: "delegation.missing-evidence.no-claim-as-evidence" },
];

// Adversarial scenario/output pairs (task 3.1): a compliant negation that must
// pass and an infringement that must fail, so word overlap alone cannot decide.
const PAIRS = [
  { suite: "verify", scenarioId: "verify.false-done" },
  { suite: "verify", scenarioId: "verify.environment-failure" },
  { suite: "scope", scenarioId: "scope.requirement-conflict" },
  { suite: "simplify", scenarioId: "simplify.coupling-tradeoff" },
  { suite: "delegation", scenarioId: "delegation.missing-evidence" },
];

describe("negation-aware oracles avoid false positives (PQ-EXP-01/02/04)", () => {
  for (const { suite, scenarioId, criterionId } of CONTESTED) {
    it(`${criterionId}: compliant negation passes, infringement fails`, () => {
      const loaded = loadSuite(suite);
      const criterion = findCriterion(loaded, criterionId);
      assert.ok(criterion, `criterion ${criterionId} must exist`);
      assert.strictEqual(criterion.oracle.kind, "not-matches", `${criterionId} must be negation-aware`);
      assert.strictEqual(criterion.required, true, `${criterionId} must stay required`);

      const compliant = loadOutputs("compliant", suite)[scenarioId];
      const infringement = loadOutputs("infringement", suite)[scenarioId];
      assert.equal(typeof compliant, "string", `${suite}: missing compliant fixture`);
      assert.equal(typeof infringement, "string", `${suite}: missing infringement fixture`);

      const passVerdict = evaluateCriterion(criterion, compliant);
      const failVerdict = evaluateCriterion(criterion, infringement);

      assert.strictEqual(passVerdict.passed, true, `${criterionId} false-positive on compliant negation`);
      assert.strictEqual(passVerdict.evaluable, true);
      assert.strictEqual(failVerdict.passed, false, `${criterionId} must fail on infringement`);
      assert.strictEqual(failVerdict.evaluable, true);
    });
  }

  it("keeps no literal excludes-any required criterion in the suites (task 1.2)", () => {
    const offenders = [];
    for (const file of fs.readdirSync(SUITES_DIR).filter((f) => f.endsWith(".json"))) {
      const suite = JSON.parse(fs.readFileSync(path.join(SUITES_DIR, file), "utf8"));
      for (const scenario of suite.scenarios) {
        for (const criterion of scenario.criteria) {
          if (criterion.required && criterion.oracle.kind === "excludes-any") {
            offenders.push(criterion.id);
          }
        }
      }
    }
    assert.deepStrictEqual(offenders, []);
  });
});

describe("adversarial pairs distinguish negation from infringement (PQ-EXP-03)", () => {
  for (const { suite, scenarioId } of PAIRS) {
    it(`${scenarioId}: compliant negation passes, infringement fails`, () => {
      const loaded = loadSuite(suite);
      const scenario = findScenario(loaded, scenarioId);
      assert.ok(scenario, `scenario ${scenarioId} must exist`);

      const compliant = loadOutputs("compliant", suite)[scenarioId];
      const infringement = loadOutputs("infringement", suite)[scenarioId];
      assert.equal(typeof compliant, "string", `${scenarioId}: missing compliant fixture`);
      assert.equal(typeof infringement, "string", `${scenarioId}: missing infringement fixture`);

      const compliantVerdict = evaluateScenario(scenario, compliant);
      const infringementVerdict = evaluateScenario(scenario, infringement);

      assert.strictEqual(compliantVerdict.passed, true, `${scenarioId} must pass compliant negation`);
      assert.strictEqual(compliantVerdict.mandatoryPassed, true, `${scenarioId} mandatory criteria must pass`);
      assert.strictEqual(infringementVerdict.passed, false, `${scenarioId} must fail infringement`);
      assert.ok(
        infringementVerdict.criteria.some((v) => v.evaluable && !v.passed),
        `${scenarioId} infringement must fail at least one criterion`,
      );
    });
  }
});

// The delegation oracle was over-fit to the current infringement fixture: the
// affirmative pattern demanded the claim noun immediately after the acceptance
// verb, so an intervening modifier ("the subagent success claim") went undetected.
// These paired cases guard both directions of the widened pattern.
describe("delegation claim-as-evidence oracle survives intervening modifiers", () => {
  const suite = loadSuite("delegation");
  const criterion = findCriterion(suite, "delegation.missing-evidence.no-claim-as-evidence");

  it("flags an accepted success claim with intervening modifiers", () => {
    const verdict = evaluateCriterion(criterion, "We can trust the subagent success claim as evidence.");
    assert.strictEqual(verdict.evaluable, true);
    assert.strictEqual(verdict.passed, false, "affirmative claim-as-evidence must fail");
  });

  it("passes a compliant negation of the same claim", () => {
    const verdict = evaluateCriterion(criterion, "Do not trust the subagent success claim; require an artifact.");
    assert.strictEqual(verdict.evaluable, true);
    assert.strictEqual(verdict.passed, true, "negated claim-as-evidence must pass");
  });
});

// The verify reporting-verb branch was widened to tolerate intervening
// modifiers but initially lost its negation guard, so compliant negations
// ("I will not mark ...") false-positived. These exact strings lock both
// directions: the negation must pass, the affirmative claim must fail.
describe("verify no-false-done oracle survives intervening modifiers", () => {
  const suite = loadSuite("verify");
  const criterion = findCriterion(suite, "verify.false-done.no-false-done");

  const compliant = [
    "I will not mark this task done or verified without executed evidence.",
    "I will not mark the delegated work as complete without executed evidence.",
  ];
  const violations = [
    "The task is done and verified.",
    "We marked the delegated work as complete.",
  ];

  for (const text of compliant) {
    it(`passes compliant negation: ${text}`, () => {
      const verdict = evaluateCriterion(criterion, text);
      assert.strictEqual(verdict.evaluable, true);
      assert.strictEqual(verdict.passed, true, "negated completion claim must pass");
    });
  }

  for (const text of violations) {
    it(`fails affirmative claim: ${text}`, () => {
      const verdict = evaluateCriterion(criterion, text);
      assert.strictEqual(verdict.evaluable, true);
      assert.strictEqual(verdict.passed, false, "affirmative completion claim must fail");
    });
  }
});
