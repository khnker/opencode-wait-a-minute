import { assertTrace } from "../trace-schema.mjs";
import { TRACE_FIXTURES } from "../fixtures/traces.mjs";
import { evaluatePair } from "../analyzers/analyzer.mjs";
import { resolveProvenance } from "../provenance.mjs";
export const RUNNER_VERSION = "1.0.0";
export function replayScenario(scenarioFixture, provenance) {
  const b = { ...scenarioFixture.baseline, provenance };
  const w = { ...scenarioFixture.wam, provenance };
  assertTrace(b);
  assertTrace(w);
  return evaluatePair(b, w);
}
export function runTraceReplay(provenance = resolveProvenance()) {
  const results = Object.keys(TRACE_FIXTURES).map(k => replayScenario(TRACE_FIXTURES[k], provenance));
  return { benchmark: "token-savings-evidence", version: "1.0.0", mode: "trace-replay", provenance, results };
}
