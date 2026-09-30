# Design: Real Token Savings Evidence

## Architecture

```text
benchmark scenario
       │
       ▼
     runner
       │
   ┌───┴────┐
   │        │
baseline    WAM
   │        │
   └───┬────┘
       ▼
 execution trace
       │
       ▼
    analyzer
       │
   ┌───┼────────────┐
   │   │            │
tokens progress provenance
   │   │            │
   └───┴────────────┘
       │
       ▼
 evidence bundle
       │
   ┌───┼───────┐
   │   │       │
 raw summary report
       │
       ▼
     charts
```

## Trace Model

A trace must contain enough information to reconstruct the token and progress measurements.

Conceptually:

```js
{
  schemaVersion,
  runId,
  scenarioId,
  condition: "baseline" | "wam",
  mode: "trace-replay" | "real-model",

  provenance: {
    gitSha,
    dirty,
    benchmarkVersion,
    scenarioVersion,
    runnerVersion,
    analyzerVersion
  },

  model: {
    provider,
    name
  },

  turns: [
    {
      turnId,
      inputTokens,
      outputTokens,
      totalTokens,
      tokenSource,
      contextSnapshot,
      toolCalls
    }
  ],

  progress: {
    requirementsVerified,
    completionVerified,
    finalState
  }
}
```

## Token Sources

The analyzer must support an explicit token source:

```text
provider
tokenizer
trace
estimated
```

`provider` has highest evidentiary authority.

`estimated` must remain visibly marked as estimated.

## Baseline vs WAM

The baseline runner must represent execution without WAM-specific lifecycle behavior.

It must not receive:

* artificially larger prompts
* artificial delays
* artificial retries
* artificial context expansion

The only intended difference is the presence or absence of WAM.

## Trace Replay

Trace replay provides deterministic CI evidence.

A replay must:

* consume a fixed trace fixture
* produce deterministic measurements
* preserve negative savings
* validate analyzer correctness
* validate schema compatibility

Replay must not silently regenerate token counts from scenario constants.

## Real Model Runner

The real runner must:

1. load a scenario
2. establish a clean initial state
3. execute baseline
4. restore the same initial state
5. execute WAM
6. capture provider usage and execution events
7. emit raw evidence

The runner must support repeated paired runs.

## Analysis

The analyzer calculates:

```text
inputTokens
outputTokens
totalTokens

inputSavingsPct
totalSavingsPct

verifiedProgress
verifiedProgressPer1kInputTokens
```

For repeated runs:

```text
min
p25
median
p75
max
```

## Charts

The report must generate at least:

### Graph A — Token Consumption

Baseline vs WAM input and total tokens per scenario.

### Graph B — Context Consumption

Input/context tokens across execution iterations.

This should expose repeated context rebuilding versus compact continuation.

### Graph C — Savings Distribution

Distribution of savings across real-model runs.

### Graph D — Verified Progress Efficiency

Verified progress per 1K input tokens.

## Evidence Bundle

Example:

```text
benchmarks/results/<timestamp>/
├── raw.json
├── summary.json
├── report.md
└── charts/
    ├── token-consumption.svg
    ├── context-consumption.svg
    ├── savings-distribution.svg
    └── verified-progress.svg
```

## CI Policy

CI executes deterministic trace replay only.

Real-model execution is explicitly opt-in.

CI must fail when:

* evidence schema is invalid
* analyzer output is inconsistent
* provenance is missing
* trace replay is nondeterministic
* negative savings are incorrectly clamped
* baseline/WAM pairing is invalid

CI must not fail simply because WAM produces negative savings for a legitimate scenario.

## Regression Policy

Deterministic regression thresholds may be applied to controlled fixtures.

Real-model results are evidence, not hardcoded pass/fail expectations.

The test suite must not assert:

```js
wamSavings > 0
```

for every scenario.

A scenario where WAM consumes more tokens is valid evidence.
