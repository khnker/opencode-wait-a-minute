# Design: Real Token Savings Evidence

## Pipeline

```text
Scenario
   │
   ▼
Runner
   ├── baseline
   └── WAM
         │
         ▼
    Execution Trace
         │
         ├── token usage
         ├── context
         ├── turns
         ├── tool calls
         └── verification
         │
         ▼
      Analyzer
         │
         ├── token metrics
         ├── savings
         ├── progress
         └── provenance
         │
         ▼
    Evidence Bundle
         │
         ├── raw.json
         ├── summary.json
         ├── report.md
         └── charts
```

## Canonical Trace

The trace schema should contain:

```js
{
  schemaVersion,
  runId,
  scenarioId,
  condition,
  mode,

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

## Token Source

Supported token sources:

```text
provider
tokenizer
trace
estimated
```

The source must be persisted with every measurement.

## Baseline

Baseline execution must be a legitimate execution without WAM-specific behavior.

The benchmark must not artificially increase baseline context, retries or turns.

## Deterministic Replay

Trace replay must:

1. load a fixed fixture;
2. validate its schema;
3. reproduce token measurements;
4. calculate derived metrics;
5. produce deterministic output.

The replay must not call external services.

## Real Runner

The real runner must:

1. prepare clean state;
2. execute baseline;
3. restore equivalent state;
4. execute WAM;
5. capture execution data;
6. persist raw evidence;
7. repeat when requested.

## Analyzer

The analyzer owns metric calculation.

It must calculate:

```text
inputTokens
outputTokens
totalTokens
inputSavingsPct
totalSavingsPct
verifiedProgress
verifiedProgressPer1kInputTokens
```

For repeated runs it calculates:

```text
min
p25
median
p75
max
```

## Charts

The benchmark should produce:

### A — Token Consumption

Baseline vs WAM tokens by scenario.

### B — Context Consumption

Context/input tokens per iteration.

### C — Savings Distribution

Distribution of savings across repeated real-model executions.

### D — Verified Progress Efficiency

Verified progress per 1K input tokens.

## Evidence Integrity

The analyzer must be able to reconstruct summary metrics from raw evidence.

The summary must not contain values that cannot be traced back to raw measurements.

## Failure Handling

Infrastructure failures must be distinguishable from task failures.

An excluded run must contain an explicit reason.

No silent filtering is permitted.
