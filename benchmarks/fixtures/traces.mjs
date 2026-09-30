export const FIXTURE_VERSION = "1.0.0";

function recordedTurns(inputs, outputs, rebuildFlags, toolCalls) {
  return inputs.map((inputTokens, i) => {
    const outputTokens = outputs[i] ?? 0;
    return {
      turnId: `t${i + 1}`,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      tokenSource: "trace",
      contextRebuilt: Boolean(rebuildFlags[i]),
      toolCalls: toolCalls[i] ?? 0
    };
  });
}

function trace(runId, scenarioId, condition, turns) {
  return {
    schemaVersion: "1.0.0",
    runId,
    scenarioId,
    condition,
    mode: "trace-replay",
    provenance: { gitSha: "", dirty: false, resolvedAt: "" },
    model: { provider: "deterministic", name: "recorded-trace" },
    turns,
    progress: { requirementsVerified: 1, totalRequirements: 1, completionVerified: true, finalState: "COMPLETED" }
  };
}

export const TRACE_FIXTURES = {
  S1: {
    name: "Simple task",
    baseline: trace("S1-baseline", "S1", "baseline", recordedTurns(
      [1500, 3400],
      [300, 300],
      [false, true],
      [1, 0]
    )),
    wam: trace("S1-wam", "S1", "wam", recordedTurns(
      [1620, 1200],
      [300, 300],
      [false, false],
      [1, 0]
    ))
  },
  S2: {
    name: "Multi-step implementation",
    baseline: trace("S2-baseline", "S2", "baseline", recordedTurns(
      [1500, 1600, 4100, 1550, 4200, 1500],
      [300, 320, 300, 300, 300, 300],
      [false, true, false, true, false, false],
      [0, 1, 0, 0, 1, 0]
    )),
    wam: trace("S2-wam", "S2", "wam", recordedTurns(
      [1700, 1500, 1550, 1550, 2600, 1500],
      [300, 320, 300, 300, 300, 300],
      [false, false, false, false, true, false],
      [0, 1, 0, 0, 1, 0]
    ))
  },
  S3: {
    name: "Failed implementation and retry",
    baseline: trace("S3-baseline", "S3", "baseline", recordedTurns(
      [1500, 4000, 1550, 4200, 1600, 4300, 1500, 4000],
      [300, 300, 300, 300, 300, 300, 300, 300],
      [false, true, false, true, false, true, false, true],
      [0, 1, 0, 0, 1, 0, 0, 1]
    )),
    wam: trace("S3-wam", "S3", "wam", recordedTurns(
      [1700, 1500, 1550, 2600, 1600, 2600, 1500, 1500],
      [300, 300, 300, 300, 300, 300, 300, 300],
      [false, false, false, true, false, true, false, false],
      [0, 1, 0, 0, 1, 0, 0, 1]
    ))
  },
  S4: {
    name: "Long-running continuation",
    baseline: trace("S4-baseline", "S4", "baseline", recordedTurns(
      [1500, 1600, 4200, 1550, 4300, 1600, 4400, 1550, 4300, 1600, 4200, 1500],
      [300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
      [false, true, false, true, false, true, false, true, false, true, false, false],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0]
    )),
    wam: trace("S4-wam", "S4", "wam", recordedTurns(
      [1700, 1500, 1550, 1550, 2600, 1500, 1550, 1550, 2600, 1500, 1550, 1500],
      [300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
      [false, false, false, false, true, false, false, false, true, false, false, false],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0]
    ))
  },
  S5: {
    name: "Multi-task/session switching",
    baseline: trace("S5-baseline", "S5", "baseline", recordedTurns(
      [1500, 4000, 1550, 4200, 1600, 4300, 1550, 4200, 1600, 1500],
      [300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
      [false, true, false, true, false, true, false, true, false, false],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 0]
    )),
    wam: trace("S5-wam", "S5", "wam", recordedTurns(
      [1700, 1500, 1550, 2600, 1600, 2600, 1550, 2600, 1600, 1500],
      [300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
      [false, false, false, true, false, true, false, true, false, false],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 0]
    ))
  },
  S6: {
    name: "Overhead regression (no clamping)",
    baseline: trace("S6-baseline", "S6", "baseline", recordedTurns(
      [1500],
      [300],
      [false],
      [0]
    )),
    wam: trace("S6-wam", "S6", "wam", recordedTurns(
      [9000],
      [300],
      [false],
      [0]
    ))
  }
};
