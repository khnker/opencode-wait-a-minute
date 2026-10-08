import { test } from "node:test";
import assert from "node:assert/strict";

import { aggregate, pairedQualityDelta, factCoverage } from "./scoring.mjs";
import { QUALITY_SCENARIOS, getQualityScenario } from "./scenarios.mjs";
import { buildBaselineRequest, buildWamRequest } from "../real/runners/paired-runner.mjs";

/**
 * Build a deterministic stub provider that mimics the paired-runner
 * contract: it has `complete({messages})` returning `{text, usage, model, provider}`.
 *
 * The stub inspects the prompt content. The baseline arm has the FULL raw
 * context (a large blob). The WAM arm context is the WAM-assembled shorter
 * prompt. With marker=baseline, the stub returns text including ALL the
 * baseline-required facts. With marker=wam-suppress, the stub omits a fact
 * specifically on prompts that look like the WAM arm (detected heuristically
 * via prompt length vs an injected minimum length).
 *
 * @param {{factList: string[], armDetect: (prompt: string) => "baseline"|"wam", omitFromArm?: string|null}} cfg
 */
function makeStubProvider(cfg) {
  const model = "stub/deterministic";
  const providerName = "stub";
  const { factList = [], armDetect, omitFromArm = null } = cfg;
  let calls = 0;
  return {
    model,
    provider: providerName,
    isConfigured: () => true,
    estimateTokens: (text = "") => Math.ceil(String(text).length / 4),
    async complete({ messages }) {
      calls += 1;
      const prompt = messages.map((m) => m.content ?? "").join("");
      const arm = armDetect(prompt);
      let text;
      if (omitFromArm && arm === omitFromArm) {
        // Emit every fact except the first (loses 1 fact on the suppressed arm).
        text = factList.slice(1).join(" ");
      } else {
        text = factList.join(" ");
      }
      return {
        text,
        usage: {
          inputTokens: Math.ceil(prompt.length / 4),
          outputTokens: Math.ceil(text.length / 4)
        },
        model,
        provider: providerName,
        latencyMs: 0
      };
    }
  };
}

/**
 * Determine which arm a given prompt belongs to by comparing its length to
 * the corresponding baseline prompt length. The WAM prompt is shorter than
 * the baseline prompt for any non-trivial context.
 */
function makeArmDetector(scenario) {
  const firstTurn = scenario.turns?.[0];
  if (!firstTurn) {
    return () => "baseline";
  }
  const baseLen = buildBaselineRequest(firstTurn).messages[0].content.length;
  const wamLen = buildWamRequest(scenario, firstTurn).messages[0].content.length;
  // Use a small tolerance since compression may leave lengths close.
  const mid = (baseLen + wamLen) / 2;
  return (prompt) => (prompt.length >= mid ? "baseline" : "wam");
}

async function runScenarioForTest(scenario, provider) {
  // Inline execution mirroring runPairedScenario so we can collect per-arm
  // fact scores in a single pass with deterministic timing.
  const turns = Array.isArray(scenario.turns) ? scenario.turns : [];
  const out = [];
  for (const [turnIndex, turn] of turns.entries()) {
    const baseline = await provider.complete(buildBaselineRequest(turn));
    const wam = await provider.complete(buildWamRequest(scenario, turn));
    const baseCov = factCoverage(baseline?.text ?? "", scenario.rubric.requiredFacts);
    const wamCov = factCoverage(wam?.text ?? "", scenario.rubric.requiredFacts);
    out.push({ turnIndex, baselineCov: baseCov, wamCov: wamCov });
  }
  const baseScores = out.map((t) => t.baselineCov.score);
  const wamScores = out.map((t) => t.wamCov.score);
  const pair = pairedQualityDelta(baseScores, wamScores);
  const baselineAgg = aggregate(baseScores);
  const wamAgg = aggregate(wamScores);
  return { out, pair, baselineAgg, wamAgg };
}

test("Case A — stub echoes all required facts: factDelta === 0, no losses", async () => {
  const scenario = getQualityScenario("Q1-exact-req-token");
  assert.ok(scenario, "scenario Q1-exact-req-token must exist");
  const armDetect = makeArmDetector(scenario);
  // Echo every fact on both arms: returns the literal fact token.
  const provider = makeStubProvider({
    factList: ["q1:-requirement[3]"],
    armDetect
  });
  const { pair, out } = await runScenarioForTest(scenario, provider);
  for (const t of out) {
    assert.equal(t.baselineCov.score, 1, `turn ${t.turnIndex} baseline should cover all facts`);
    assert.equal(t.wamCov.score, 1, `turn ${t.turnIndex} wam should cover all facts`);
  }
  assert.equal(pair.wins, 0, "no wins expected when both arms echo all facts");
  assert.equal(pair.losses, 0, "no losses expected when both arms echo all facts");
  // Mean delta may be near zero but should still report ties.
  assert.equal(pair.wins + pair.losses + pair.ties, pair.n);
});

test("Case B — stub omits a fact on WAM-only: wamFactScore < baselineFactScore and losses >= 1", async () => {
  // Use Q5 which has TWO required facts so the test can prove the runner
  // detects a partial quality delta deterministically.
  const scenario = getQualityScenario("Q5-artifact-and-constraint-tokens");
  assert.ok(scenario, "scenario Q5 must exist");
  const armDetect = makeArmDetector(scenario);
  // factList[0] is the "suppressed" fact that the WAM arm omits. Baseline
  // echoes both -> score 1.0. WAM only echoes factList[1] -> score 0.5.
  const provider = makeStubProvider({
    factList: ["q5:-artifact[2]", "q5:-constraint[1]"],
    armDetect,
    omitFromArm: "wam"
  });
  // Sanity check on the detector itself: the baseline prompt should be detected
  // as baseline, and the WAM prompt as wam.
  const baselinePrompt = buildBaselineRequest(scenario.turns[0]).messages[0].content;
  const wamPrompt = buildWamRequest(scenario, scenario.turns[0]).messages[0].content;
  assert.equal(armDetect(baselinePrompt), "baseline", "detector should classify baseline prompt as baseline");
  assert.equal(armDetect(wamPrompt), "wam", "detector should classify WAM prompt as wam");

  const { pair, baselineAgg, wamAgg, out } = await runScenarioForTest(scenario, provider);
  // Baseline arm covers all facts; WAM arm covers only the second one.
  for (const t of out) {
    assert.equal(t.baselineCov.score, 1, "baseline arm should cover all facts");
    assert.equal(
      t.wamCov.score,
      0.5,
      "wam arm should be missing the suppressed fact (covers 1 of 2 facts)"
    );
  }
  assert.ok(wamAgg.mean < baselineAgg.mean, "wam mean should be strictly less than baseline mean");
  assert.ok(pair.losses >= 1, "at least one turn must register a loss for the WAM arm");
  assert.equal(pair.wins, 0, "no wins expected when WAM is strictly worse");
  assert.ok(pair.meanDelta < 0, "overall mean delta should be negative");
});

test("Run-quality report shape — offline via stub", async () => {
  // Sanity test: just confirm the runner-shaped logic counts empty responses
  // and computes the summary numbers correctly when response text is empty.
  const scenario = getQualityScenario("Q1-exact-req-token");
  const armDetect = makeArmDetector(scenario);
  const provider = makeStubProvider({
    factList: ["q1:-requirement[3]"],
    armDetect,
    omitFromArm: "wam"
  });
  // Drive a single turn with zero-text responses for both arms.
  provider.complete = async () => ({
    text: "",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    model: "stub",
    provider: "stub",
    latencyMs: 0
  });
  const built = buildBaselineRequest(scenario.turns[0]);
  const result = await provider.complete(built);
  const cov = factCoverage(result.text, scenario.rubric.requiredFacts);
  assert.equal(cov.score, 0);
  assert.equal(cov.total, scenario.rubric.requiredFacts.length);
});
