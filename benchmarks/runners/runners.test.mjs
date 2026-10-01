import test from "node:test";
import assert from "node:assert";
import { createProvider } from "../providers/openai-compatible.mjs";
import { runBaselineTurn, getRepoCommit } from "./baseline-runner.mjs";
import { runWamTurn } from "./wam-runner.mjs";
import { runRealScenario } from "./real-session.mjs";
import { createCollector } from "../instrumentation/collector.mjs";
import { getRealScenario, REAL_SCENARIOS } from "../scenarios/real.mjs";

test("Provider Adapter", async (t) => {
  await t.test("successful completion", async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "hi" } }],
        usage: { prompt_tokens: 5, completion_tokens: 2 }
      })
    });
    const provider = createProvider({ fetchImpl: mockFetch, baseUrl: "http://a", apiKey: "b", model: "c" });
    const res = await provider.complete({ messages: [{ content: "test" }] });
    assert.strictEqual(res.text, "hi");
    assert.deepStrictEqual(res.usage, { inputTokens: 5, outputTokens: 2, totalTokens: 7 });
  });

  await t.test("non-OK response throws", async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      text: async () => "error"
    });
    const provider = createProvider({ fetchImpl: mockFetch, baseUrl: "http://a", apiKey: "b", model: "c" });
    await assert.rejects(provider.complete({ messages: [] }), /request failed: status 500/);
  });
});

test("Runners", async (t) => {
  const fakeProvider = {
    model: "fake",
    complete: async ({ messages }) => ({
      text: "response",
      usage: { inputTokens: Math.ceil(messages[0].content.length / 4), outputTokens: 10 }
    })
  };

  await t.test("A: S7 savings (baseline > wam)", async () => {
    const scenario = getRealScenario("S7");
    const res = await runRealScenario({ scenario, provider: fakeProvider, repoCommit: "test" });
    assert.strictEqual(res.counters.Context_assembled, scenario.turns.length);
    assert.ok(
      res.totals.baselineTokens > res.totals.wamTokens,
      `Baseline (${res.totals.baselineTokens}) should be > Wam (${res.totals.wamTokens})`
    );
  });

  await t.test("B: S17 continuation -> fast-path/hit", async () => {
    const scenario = getRealScenario("S17");
    const res = await runRealScenario({ scenario, provider: fakeProvider, repoCommit: "test" });
    assert.ok(res.counters.Snapshot_hit > 0, `Snapshot_hit (${res.counters.Snapshot_hit}) should be > 0`);
    assert.ok(res.counters.Context_fast_path > 0, `Context_fast_path (${res.counters.Context_fast_path}) should be > 0`);
  });

  await t.test("C: S7 changed state -> reconstruction", async () => {
    const scenario = getRealScenario("S7");
    const res = await runRealScenario({ scenario, provider: fakeProvider, repoCommit: "test" });
    assert.ok(res.counters.Context_reconstructed > 0, `Context_reconstructed (${res.counters.Context_reconstructed}) should be > 0`);
  });

  await t.test("D: S27 negative control -> no fabricated savings", async () => {
    const scenario = getRealScenario("S27");
    const res = await runRealScenario({ scenario, provider: fakeProvider, repoCommit: "test" });
    assert.ok(
      res.totals.baselineTokens <= res.totals.wamTokens,
      `Expected no savings on S27, got baseline ${res.totals.baselineTokens} vs wam ${res.totals.wamTokens}`
    );
  });

  await t.test("E: S7-S30 category invariants", async () => {
    for (const scenario of REAL_SCENARIOS) {
      const res = await runRealScenario({ scenario, provider: fakeProvider, repoCommit: "test" });
      const { baselineTokens: b, wamTokens: w } = res.totals;
      if (scenario.category === "negative") {
        assert.ok(b <= w, `${scenario.id} [negative] expected no savings, got ${b} vs ${w}`);
      } else {
        assert.ok(b > w, `${scenario.id} [${scenario.category}] expected savings, got ${b} vs ${w}`);
      }
    }
  });
});
