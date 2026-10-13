/**
 * Live-harness tests. OFFLINE: every test injects a deterministic mock provider
 * (no network). Proves the harness synthesizes task input from scenario fields,
 * records honest usage + latency, stays byte-reproducible, and that a
 * regression VETOES the variant through the existing comparison engine.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listSuites } from "./freeze-baseline.mjs";
import { runLiveVariant } from "./live.mjs";
import {
  runExperiment,
  compareExperiments,
  evaluateCandidate,
  serializeArtifact,
} from "./experiment.mjs";

const SUITES = listSuites();
const suiteById = (id) => SUITES.find((s) => s.id === id);

/** Deterministic in-process provider. `response` may be a string or fn(messages). */
function mockProvider(response) {
  const model = "mock/injected";
  const estimateTokens = (text = "") => Math.ceil(String(text).length / 4);
  return {
    model,
    provider: "mock",
    isConfigured: () => true,
    estimateTokens,
    complete: async ({ messages }) => {
      const text = typeof response === "function" ? response(messages) : response;
      const inputTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content ?? ""), 0);
      const outputTokens = estimateTokens(text);
      return {
        text,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        model,
        provider: "mock",
      };
    },
  };
}

const DELEGATION_PASS =
  "The delegation stays pending until the contract is met. " +
  "Evidence (artifacts/outputs) is collected and the success claim is not accepted as evidence.";
const DELEGATION_FAIL = "I accept the success claim and mark the task complete.";

describe("runLiveVariant synthesizes tasks and records honest cost", () => {
  it("keys outputs by scenario id and captures numeric usage + latency", async () => {
    const suite = suiteById("verify");
    const result = await runLiveVariant({
      suite,
      variantId: "V1",
      policyText: "stub policy",
      provider: mockProvider("Observed output."),
    });

    const ids = suite.scenarios.map((s) => s.id).sort();
    assert.deepEqual(Object.keys(result.outputs).sort(), ids);
    for (const id of ids) assert.equal(typeof result.outputs[id], "string");

    assert.equal(result.perScenario.length, suite.scenarios.length);
    for (const entry of result.perScenario) {
      assert.ok(ids.includes(entry.scenarioId));
      assert.equal(typeof entry.usage.inputTokens, "number");
      assert.equal(typeof entry.usage.outputTokens, "number");
      assert.equal(typeof entry.usage.totalTokens, "number");
      assert.ok(Number.isFinite(entry.latencyMs) && entry.latencyMs >= 0);
    }

    assert.equal(result.cost.source, "mock");
    assert.equal(result.cost.provider, "mock");
    assert.equal(result.cost.model, "mock/injected");
    assert.ok(result.cost.tokens.total > 0);
    assert.equal(result.cost.executionFailures, 0);
    assert.equal(result.cost.latencyMs.n, suite.scenarios.length);
  });

  it("records a failure instead of fabricating usage when the provider throws", async () => {
    const suite = suiteById("verify");
    const failing = {
      model: "mock/injected",
      provider: "mock",
      isConfigured: () => true,
      estimateTokens: () => 0,
      complete: async () => {
        throw new Error("boom");
      },
    };
    const result = await runLiveVariant({
      suite,
      variantId: "V1",
      policyText: "stub",
      provider: failing,
    });
    assert.equal(result.cost.executionFailures, suite.scenarios.length);
    assert.equal(result.cost.tokens.total, 0);
    for (const id of Object.keys(result.outputs)) assert.equal(result.outputs[id], "");
    assert.ok(result.perScenario.every((e) => typeof e.error === "string"));
  });
});

describe("live harness is reproducible", () => {
  it("identical provider responses ⇒ identical outputs, report and config", async () => {
    const suite = suiteById("verify");
    const call = () =>
      runLiveVariant({
        suite,
        variantId: "V1",
        policyText: "stable policy",
        provider: mockProvider("Deterministic body."),
      });

    const first = await call();
    const second = await call();
    assert.deepEqual(first.outputs, second.outputs);
    assert.deepEqual(first.perScenario.map((e) => e.usage), second.perScenario.map((e) => e.usage));

    const evidence = () =>
      runExperiment({
        suiteId: "verify",
        variant: "V1",
        promptContents: { "policy.verify.rules": "stable policy" },
        outputs: first.outputs,
        suites: [suite],
        cost: { tokens: first.cost.tokens, latencyMs: first.cost.latencyMs, executionFailures: 0 },
      });
    const a = evidence();
    const b = evidence();
    assert.equal(serializeArtifact(a.config), serializeArtifact(b.config));
    assert.equal(serializeArtifact(a.report), serializeArtifact(b.report));
  });
});

describe("a regressing variant is vetoed regardless of cost", () => {
  it("VETOES the candidate when it fails a critical required criterion", async () => {
    const suite = suiteById("delegation");
    const promptContents = { "injection.delegation": "stub active delegation policy" };

    const baselineLive = await runLiveVariant({
      suite,
      variantId: "D1",
      policyText: promptContents["injection.delegation"],
      provider: mockProvider(DELEGATION_PASS),
    });
    const variantLive = await runLiveVariant({
      suite,
      variantId: "D1",
      policyText: "stub experimental delegation policy",
      provider: mockProvider(DELEGATION_FAIL),
    });

    const baseline = runExperiment({
      suiteId: "delegation",
      variant: "baseline",
      promptContents,
      outputs: baselineLive.outputs,
      suites: [suite],
      cost: { tokens: { input: 1000, output: 1000, total: 2000 }, latencyMs: { sum: 1000, mean: 1000, n: 1 }, executionFailures: 0 },
    });
    const candidate = runExperiment({
      suiteId: "delegation",
      variant: "D1",
      promptContents: { "injection.delegation": "stub experimental delegation policy" },
      outputs: variantLive.outputs,
      suites: [suite],
      cost: { tokens: { input: 1, output: 1, total: 2 }, latencyMs: { sum: 1, mean: 1, n: 1 }, executionFailures: 0 },
    });

    const comparison = compareExperiments(baseline, candidate);
    assert.equal(comparison.decision.decision, "REGRESSION");
    assert.equal(evaluateCandidate(baseline, candidate).vetoed, true);
  });
});
