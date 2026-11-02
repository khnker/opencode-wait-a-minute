# Design: Benchmark Agent Orchestration

## Research

- Anthropic multi-agent research system: multi-agent runs can improve coverage
  but consume substantially more tokens than a single agent.
  https://www.anthropic.com/engineering/multi-agent-research-system
- Existing WAM benchmark conventions: deterministic fixtures, JSON artifacts,
  no wall-clock assertions (`benchmarks/continuity-comparison.test.mjs`,
  `benchmarks/evidence/methodology.md`).
- Existing orchestration tests already use fake adapters and role-shaped
  results (`tests/unit/agent-feedback.test.mjs`).

## Alternatives

### 1. Real LLM calls

Rejected. They are non-deterministic, slow and cost money. A benchmark that
cannot be reproduced on every CI run is not a regression gate.

### 2. Replay recorded traces

Rejected. There are no recorded multi-agent traces for these scenarios yet, and
building trace capture is a separate capability.

### 3. Deterministic fake adapters

Chosen. Fake adapters return role-shaped results from a fixed script. The
benchmark measures pipeline structure, review coverage, feedback cycles and
deterministic token estimates, not model intelligence.

## Design

Scenarios:

- `accepted-first-pass`: every role completes; Reviewer accepts immediately.
- `revision-accepted`: Builder's first result misses a mandatory criterion;
  Reviewer requests revision with evidence; Builder fixes; Reviewer accepts.
- `replan-accepted`: Reviewer requests replan; Architect proposes another
  design; Builder implements; Reviewer accepts.
- `exhausted`: Reviewer keeps requesting revision; the configured bound is
  exhausted and the outcome is flagged.

Baseline: one `BUILDER` invocation returns the same first-pass implementation
without independent review. The benchmark records whether the injected defect
is caught.

Metrics:

- `invocations.total` and `invocations.byRole`;
- `cycles.revisions`, `cycles.replans`;
- `findingsCaught`;
- `estimatedTokens` from deterministic prompt/result character counts;
- `accepted`, `exhausted`, `defectResolved`.

No metric depends on elapsed time. The harness returns plain objects so tests
can assert exact values.

## Risks

- Synthetic tokens are an estimate, not provider billing. The report must label
  them as estimates.
- Fake adapters can make the pipeline look better than real models; the
  benchmark claims coverage and boundedness, not real-world quality.
- Scenario scripts must stay valid under the role contracts; tests will fail
  loudly if a result shape drifts.

## Impact

- `benchmarks/agent-orchestration/index.mjs`: harness.
- `benchmarks/agent-orchestration/benchmark.test.mjs`: deterministic tests.
- `benchmarks/agent-orchestration/README.md`: methodology and limitations.
- No production code changes.
