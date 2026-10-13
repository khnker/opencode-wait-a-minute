import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCriterion, evaluateScenario } from "./deterministic.mjs";

function crit(overrides) {
  return {
    id: "test.criterion",
    required: true,
    description: "human intent text (NEVER matched)",
    oracle: { kind: "includes-all", values: ["complete"], flags: "i" },
    ...overrides,
  };
}

describe("prompt-eval deterministic evaluator", () => {
  it("PQ-ORACLE-01: includes-any passes on a different accepted phrasing", async () => {
    const criterion = crit({
      id: "c1",
      oracle: { kind: "includes-any", values: ["complete", "finished", "done"], flags: "i" },
    });
    const verdict = evaluateCriterion(criterion, "Task is finished");
    assert.strictEqual(verdict.passed, true);
    assert.strictEqual(verdict.evaluable, true);
    assert.ok(verdict.evidence.includes("finished"));
  });

  it("PQ-ORACLE-02: output equal to description (no observable evidence) fails", async () => {
    const description = "human intent text (NEVER matched)";
    const criterion = crit({
      id: "c2",
      description,
      oracle: { kind: "includes-any", values: ["observable evidence"], flags: "i" },
    });
    const verdict = evaluateCriterion(criterion, description);
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.evaluable, true);
    assert.ok(verdict.evidence.includes("None of the required values present"));
  });

  it("PQ-ORACLE-03: excludes-any detects forbidden observable and fails", async () => {
    const criterion = crit({
      id: "c3",
      oracle: { kind: "excludes-any", values: ["DONE", "verified"], flags: "i" },
    });
    const verdict = evaluateCriterion(criterion, "Declared DONE early");
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.evaluable, true);
    assert.ok(verdict.evidence.toLowerCase().includes("done"));
  });

  it("PQ-ORACLE-04: matches regex passes on structured output and fails otherwise", async () => {
    const criterion = crit({
      id: "c4",
      oracle: { kind: "matches", values: ["exit\\s*code\\s*\\d+"], flags: "i" },
    });
    assert.strictEqual(evaluateCriterion(criterion, "exit code 1").passed, true);
    assert.strictEqual(evaluateCriterion(criterion, "exit code").passed, false);
    assert.strictEqual(evaluateCriterion(criterion, "no code here").passed, false);
  });

  it("PQ-ORACLE-05: empty output is not-evaluable (never passed)", async () => {
    const verdict = evaluateCriterion(crit(), "");
    assert.strictEqual(verdict.passed, false);
    assert.strictEqual(verdict.evaluable, false);
    assert.ok(verdict.evidence.includes("missing or empty"));
  });

  it("includes-all requires every value", async () => {
    const criterion = crit({
      oracle: { kind: "includes-all", values: ["a", "b"], flags: "i" },
    });
    assert.strictEqual(evaluateCriterion(criterion, "a and b").passed, true);
    assert.strictEqual(evaluateCriterion(criterion, "only a").passed, false);
  });

  it("excludes-any passes when none of the values appear", async () => {
    const criterion = crit({
      oracle: { kind: "excludes-any", values: ["forbidden", "blocked"], flags: "i" },
    });
    assert.strictEqual(evaluateCriterion(criterion, "clean output").passed, true);
    assert.strictEqual(evaluateCriterion(criterion, "contains blocked").passed, false);
  });

  it("not-matches regex passes when regex does not match", async () => {
    const criterion = crit({
      oracle: { kind: "not-matches", values: ["DONE"], flags: "i" },
    });
    assert.strictEqual(evaluateCriterion(criterion, "pending").passed, true);
    assert.strictEqual(evaluateCriterion(criterion, "DONE").passed, false);
  });

  it("unknown oracle kind is not evaluable", async () => {
    const criterion = crit({ oracle: { kind: "unknown", values: ["x"] } });
    const verdict = evaluateCriterion(criterion, "x");
    assert.strictEqual(verdict.evaluable, false);
    assert.strictEqual(verdict.passed, false);
  });

  it("invalid regex is not evaluable", async () => {
    const criterion = crit({
      oracle: { kind: "matches", values: ["[invalid"], flags: "i" },
    });
    const verdict = evaluateCriterion(criterion, "anything");
    assert.strictEqual(verdict.evaluable, false);
    assert.strictEqual(verdict.passed, false);
  });

  it("evaluateScenario returns one verdict per criterion", async () => {
    const scenario = {
      id: "test.scenario",
      criteria: [
        crit({ id: "c1", oracle: { kind: "includes-all", values: ["task"], flags: "i" } }),
        crit({ id: "c2", oracle: { kind: "excludes-any", values: ["done"], flags: "i" } }),
      ],
    };
    const result = evaluateScenario(scenario, "Task pending");
    assert.strictEqual(result.scenarioId, "test.scenario");
    assert.strictEqual(result.criteria.length, 2);
    assert.strictEqual(result.criteria[0].passed, true);
    assert.strictEqual(result.criteria[1].passed, true);
    assert.strictEqual(result.passed, true);
  });

  it("PQ-CORR-01: required non-evaluable criterion fails the scenario", async () => {
    const scenario = {
      id: "s.corr-01",
      severity: "critical",
      criteria: [
        crit({ id: "c1", required: true, oracle: { kind: "unknown-kind", values: ["x"], flags: "i" } }),
        crit({ id: "c2", required: false, oracle: { kind: "includes-all", values: ["complete"], flags: "i" } }),
      ],
    };
    const result = evaluateScenario(scenario, "complete output");
    assert.strictEqual(result.passed, false);
    assert.strictEqual(result.evaluable, false);
    assert.strictEqual(result.mandatoryPassed, false);
    const c1 = result.criteria.find((c) => c.criterionId === "c1");
    assert.ok(c1.evidence.includes("Unknown oracle kind"));
  });

  it("PQ-CORR-02: empty output is never a pass", async () => {
    const scenario = {
      id: "s.corr-02",
      severity: "critical",
      criteria: [
        crit({ id: "c1", required: true, oracle: { kind: "includes-all", values: ["complete"], flags: "i" } }),
      ],
    };
    for (const output of ["", "   ", null, undefined]) {
      const result = evaluateScenario(scenario, output);
      assert.strictEqual(result.passed, false, `output=${JSON.stringify(output)}`);
      assert.strictEqual(result.evaluable, false, `output=${JSON.stringify(output)}`);
    }
  });

  it("PQ-CORR-03: all required criteria passing yields a pass", async () => {
    const scenario = {
      id: "s.corr-03",
      severity: "high",
      criteria: [
        crit({ id: "c1", required: true, oracle: { kind: "includes-all", values: ["alpha"], flags: "i" } }),
        crit({ id: "c2", required: true, oracle: { kind: "includes-all", values: ["beta"], flags: "i" } }),
        crit({ id: "c3", required: false, oracle: { kind: "excludes-any", values: ["gamma"], flags: "i" } }),
      ],
    };
    const result = evaluateScenario(scenario, "alpha beta");
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.evaluable, true);
    assert.strictEqual(result.mandatoryPassed, true);
  });
});
