# Agent orchestration benchmark

Deterministic comparison between a single Builder invocation and the bounded
Analyst > Architect > Builder > Reviewer feedback pipeline.

## Method

- Fake adapters return role-shaped results from fixed scripts. No model calls
  and no wall-clock assertions are used.
- Each scenario is run twice in `benchmark.test.mjs`; the full records must be
  identical.
- Scenarios:
  - `accepted-first-pass`: no injected defect.
  - `revision-accepted`: Reviewer catches a missing rate limit and Builder fixes
    it.
  - `replan-accepted`: Reviewer rejects the design, Architect replans and
    Builder implements the new plan.
  - `exhausted`: Reviewer keeps requesting revision and the configured bound is
    exhausted.

## Metrics

- `invocations.total` and `invocations.byRole`.
- `cycles.revisions` and `cycles.replans`.
- `findingsCaught`: review findings emitted by the Reviewer.
- `accepted`: completed with an `ACCEPTED` review.
- `exhausted`: feedback bound was exhausted.
- `defectResolved`: the injected defect was caught and the run ended accepted.
- `falseAccept`: the baseline reported completion while the injected defect was
  still present.
- `estimatedTokens`: `ceil(total JSON characters / 4)` across requests and
  results.

## Real collaboration benchmark

`real-collaboration.mjs` runs the same `runAgentFeedbackOrchestration` pipeline
with an adapter supplied by the caller, so a real model/adapter can be measured
without changing the benchmark. CI and tests stay offline: they inject a
deterministic scripted adapter, and no model is called unless you opt in.

```bash
WAM_AGENT_BENCH_ADAPTER=/absolute/path/to/my-adapter.mjs npm run bench:agents:real
```

The module named by `WAM_AGENT_BENCH_ADAPTER` must export
`createAdapterFactory` (preferred) or a default function with this contract:

```js
export function createAdapterFactory({ scenario }) {
  // scenario: { id, seed, objective, maxRevisionCycles, maxReplanCycles, expected }
  return {
    // request is the validated AgentRequest produced by the orchestrator
    async invoke(request) {
      // { result: AgentResult, metadata?: { sessionID } }
      return { result, metadata: { sessionID: "my-session" } };
    },
  };
}
```

The factory is called once per scenario so each run gets a fresh adapter. The
CLI prints a JSON report with per-scenario metrics and exits nonzero when the
variable/export is missing or a scenario misses its expected outcome. Scenarios
are `accepted-first-pass` and `revision-accepted`; each has a distinct seed and
objective.

## Limitations

- Token counts are estimates, not provider billing.
- Fake adapters measure pipeline structure and review coverage, not model
  quality.
- The benchmark does not claim that the extra invocations always pay off; it
  quantifies their cost and the coverage they add under the scripted scenarios.
