import { test } from "node:test";
import assert from "node:assert/strict";
import { runPairedScenario, runPairedSuite } from "./paired-runner.mjs";

/**
 * Deterministic mock provider.
 * - mode "same":    every call returns identical text  -> outcome parity holds
 * - mode "diverge": text differs per call              -> outcome parity fails
 *
 * Records every request it receives so we can assert both arms were fed the
 * exact same base prompt (protocol rule 2, No Cross-Contamination).
 */
function makeDeterministicProvider({
  mode = "same",
  text = "OK",
  inputTokens = 100,
  outputTokens = 10,
  totalTokens,
  latencyMs = 5,
  cachedInputTokens = 0
} = {}) {
  const calls = [];
  let n = 0;

  const provider = {
    model: "mock/deterministic",
    isConfigured: () => true,
    estimateTokens: (t = "") => Math.ceil(String(t).length / 4),
    complete: async (req) => {
      n += 1;
      const prompt = (req?.messages ?? []).map((m) => m.content).join("");
      calls.push({ prompt, messages: req?.messages, callIndex: n });

      const body = mode === "diverge" ? `${text}-arm${n}` : text;
      return {
        text: body,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: totalTokens ?? inputTokens + outputTokens,
          cachedInputTokens
        },
        latencyMs,
        finishReason: "stop",
        toolCalls: undefined,
        model: "mock/deterministic",
        provider: "mock"
      };
    }
  };

  provider.calls = calls;
  return provider;
}

test("runPairedScenario returns VALID when both arms produce identical output", async () => {
  const provider = makeDeterministicProvider({
    text: "OK",
    inputTokens: 100,
    outputTokens: 10,
    latencyMs: 5
  });
  const scenario = {
    id: "s1",
    turns: [
      { input: { taskId: "t1" }, prompt: "p1" },
      { input: { taskId: "t2" }, prompt: "p2" }
    ]
  };

  const result = await runPairedScenario({ scenario, provider });

  assert.equal(result.scenarioId, "s1");
  assert.equal(result.comparison, "VALID");
  assert.equal(result.outcomeMatch, true);
  assert.equal(result.turns.length, 2);
  assert.equal(typeof result.metrics.inputTokenReductionPct, "number");
  assert.ok(Number.isFinite(result.metrics.inputTokenReductionPct));
  assert.equal(typeof result.metrics.totalTokenDeltaPct, "number");
  assert.ok(Number.isFinite(result.metrics.totalTokenDeltaPct));
  assert.equal(typeof result.metrics.latencyDeltaPct, "number");
  assert.ok(Number.isFinite(result.metrics.latencyDeltaPct));
  // Same input/output/latency on both arms -> 0% delta
  assert.equal(result.metrics.inputTokenReductionPct, 0);
  assert.equal(result.metrics.totalTokenDeltaPct, 0);
  assert.equal(result.metrics.latencyDeltaPct, 0);
  assert.equal(result.metrics.cachedInputTokens, 0);
  assert.equal(result.metrics.invalidReason, undefined);
});

test("runPairedScenario returns INVALID_COMPARISON when arms diverge and suppresses savings", async () => {
  const provider = makeDeterministicProvider({ mode: "diverge", text: "OK" });
  const scenario = {
    id: "s2",
    turns: [{ input: { taskId: "t1" }, prompt: "p1" }]
  };

  const result = await runPairedScenario({ scenario, provider });
  assert.equal(result.comparison, "INVALID_COMPARISON");
  assert.equal(result.outcomeMatch, false);
  assert.equal(result.turns[0].outcomeMatch, false);
  // Savings must be suppressed: null (not 0) marks "not comparable",
  // distinct from a genuine 0% reduction.
  assert.equal(result.metrics.inputTokenReductionPct, null);
  assert.equal(result.metrics.totalTokenDeltaPct, null);
  assert.equal(result.metrics.latencyDeltaPct, null);
  assert.equal(result.metrics.invalidReason, "outcome_mismatch");
  // cachedInputTokens is still tracked: provider cache is independent of parity
  assert.equal(result.metrics.cachedInputTokens, 0);
});

test("baseline output is NEVER injected into WAM arm (no cross-contamination)", async () => {
  const provider = makeDeterministicProvider({ mode: "diverge", text: "SECRET-BASELINE" });
  const scenario = {
    id: "s3",
    turns: [{ input: { taskId: "t1" }, prompt: "BASE PROMPT" }]
  };

  await runPairedScenario({ scenario, provider });

  // One turn => exactly two provider calls (baseline arm, then WAM arm).
  assert.equal(provider.calls.length, 2);
  // Both arms received the exact same base prompt from scenario state.
  assert.equal(provider.calls[0].prompt, "BASE PROMPT");
  assert.equal(provider.calls[1].prompt, "BASE PROMPT");
  // The WAM arm request contains no trace of the baseline arm's output.
  const wamRequest = JSON.stringify(provider.calls[1].messages);
  assert.equal(wamRequest.includes("SECRET-BASELINE"), false);
});

test("WAM algorithmic input reduction is reported when WAM arm uses fewer input tokens", async () => {
  let call = 0;
  const provider = {
    model: "mock/asymmetric",
    isConfigured: () => true,
    estimateTokens: () => 0,
    complete: async () => {
      call += 1;
      // baseline arm sees 1000 input tokens, WAM arm sees 600
      const inputTokens = call % 2 === 1 ? 1000 : 600;
      return {
        text: "SAME",
        usage: { inputTokens, outputTokens: 10, totalTokens: inputTokens + 10, cachedInputTokens: 0 },
        latencyMs: 10,
        model: "mock/asymmetric",
        provider: "mock"
      };
    }
  };
  const scenario = { id: "s4", turns: [{ input: { taskId: "t" }, prompt: "p" }] };

  const result = await runPairedScenario({ scenario, provider });
  assert.equal(result.comparison, "VALID");
  assert.equal(result.metrics.inputTokenReductionPct, 40);
});

test("cachedInputTokens aggregates across turns independently of input reduction", async () => {
  const provider = makeDeterministicProvider({ text: "OK", cachedInputTokens: 25 });
  const scenario = {
    id: "s5",
    turns: [
      { input: { taskId: "t1" }, prompt: "p1" },
      { input: { taskId: "t2" }, prompt: "p2" }
    ]
  };

  const result = await runPairedScenario({ scenario, provider });
  // 25 cached tokens reported per turn, 2 turns -> 50, reported on its own field.
  assert.equal(result.metrics.cachedInputTokens, 50);
  // Identical input tokens on both arms -> no WAM reduction, despite cache savings.
  assert.equal(result.metrics.inputTokenReductionPct, 0);
});

test("runPairedSuite aggregates totals across scenarios and trials", async () => {
  const provider = makeDeterministicProvider({ text: "OK" });
  const scenarios = [
    { id: "a", turns: [{ input: { taskId: "a1" }, prompt: "pa" }] },
    { id: "b", turns: [{ input: { taskId: "b1" }, prompt: "pb" }] }
  ];

  const result = await runPairedSuite({ scenarios, provider, trials: 2 });
  assert.equal(result.runs.length, 4);
  assert.equal(result.totals.turns, 4);
  assert.equal(result.totals.valid, 4);
  assert.equal(result.totals.invalid, 0);
  assert.equal(result.runs[0].trial, 0);
  assert.equal(result.runs[1].trial, 1);
});

test("runPairedSuite counts invalid runs separately from valid", async () => {
  const provider = makeDeterministicProvider({ mode: "diverge", text: "OK" });
  const scenarios = [
    { id: "a", turns: [{ input: { taskId: "a1" }, prompt: "pa" }] },
    { id: "b", turns: [{ input: { taskId: "b1" }, prompt: "pb" }] }
  ];

  const result = await runPairedSuite({ scenarios, provider, trials: 1 });
  assert.equal(result.totals.valid, 0);
  assert.equal(result.totals.invalid, 2);
  for (const run of result.runs) {
    assert.equal(run.metrics.inputTokenReductionPct, null);
    assert.equal(run.metrics.invalidReason, "outcome_mismatch");
  }
});
