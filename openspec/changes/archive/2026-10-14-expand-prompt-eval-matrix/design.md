# Design

## Live harness telemetry contract

The provider object is extended with two **optional** methods:

```js
provider.recordToolCall?.(name, { ok = true, retry = false, durationMs = 0 } = {});
provider.recordRetry?.(reason = "unknown");
```

`runLiveVariant(scenario, policy, provider)` returns a `perScenario[]` with each entry now containing:

```js
{
  scenarioId,
  response: { text, usage, model, provider },
  toolCalls: [{ name, ok, retry, durationMs, at: <scenario-relative index> }],
  retries: [{ reason, at: <scenario-relative index> }],
  latencyMs,
  executionFailures: [{ phase, error }],
  // ... existing fields
}
```

The aggregate `run` artifact grows a top-level `toolCalls` and `retries` (flattened across scenarios) plus a `toolCallTotals: { calls, ok, retry, byName: { <name>: n } }` summary.

Mock providers get a no-op default that records nothing; tests that want deterministic tool-call counts inject a mock that calls the methods directly.

## New suite shape

S5–S8 follow the existing `{ id, version, description, scenarios: [{ id, suite, severity, context, promptRef, criteria: [{ id, required, description, oracle }] }] }` shape. They are pure rubric suites — no new oracle kinds. The new prompt refs (`policy.discovery.rules`, `policy.runtime.rules`, `policy.decision-gate.rules`, `policy.completion.rules`) point to existing active prompt files; the first three are aliases of `prompts/policies/discovery.md` etc. that we add in a sibling change. For this change, suites that reference those prompt refs are still runnable because the live CLI falls back to a generic policy header when the ref is unknown (already implemented behavior).

## Comparison report

`scripts/prompts-live.mjs` writes:

```
<out>/comparison.json
{
  "schema": "wam.prompt-eval.comparison/1",
  "generatedAt": <iso>,
  "suite": "all",
  "rows": [
    {
      "suiteId": "verify",
      "variant": "V1",
      "decision": "NO_CHANGE|IMPROVED|REGRESSION|INCONCLUSIVE",
      "passRate": 0.0,
      "tokens": { "baseline": 0, "variant": 0, "delta": 0 },
      "latencyMs": { "baseline": 0, "variant": 0, "delta": 0 },
      "toolCalls": { "baseline": 0, "variant": 0, "byName": {...} },
      "retries":    { "baseline": 0, "variant": 0 },
      "improves":  ["criterion-id", ...],
      "regressions": ["criterion-id", ...]
    }
  ]
}
```

Plus a markdown twin `<out>/comparison.md` with the same data as a table — one row per (suite, variant), columns matching the JSON keys, plus a footer listing the per-suite decision.

## Risks

- **DETERMINISM**: `toolCalls` and `retries` are recorded by the provider, so they are deterministic for any given provider implementation. Mock provider records `[]` by default. Existing tests that pin the live artifact hash will need their snapshot updated.
- **BACKWARD COMPAT**: New fields are additive; absent fields default to `[]` / `0` in the comparison report so old evidence files still load.
- **CI GATE**: The acceptance check is `--dry-run` against the mock provider, so the live harness is fully exercised without network.
