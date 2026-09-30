# Change: Implement Real Token Savings Evidence

## Why

The current token-savings benchmark uses a synthetic deterministic model based on hardcoded scenario parameters such as turns, context rebuilds and WAM overhead.

This is useful for validating benchmark arithmetic, but it is not evidence of actual token consumption.

The benchmark must measure real execution data and clearly distinguish observed, measured, derived and estimated values.

## What Changes

Replace the synthetic token-consumption model with a trace-based evidence pipeline.

The benchmark will support two modes:

1. Deterministic trace replay
2. Opt-in real-model execution

Both modes must use the same evidence schema and analysis pipeline.

## Deterministic Trace Replay

Deterministic fixtures represent captured execution traces.

The replay system MUST NOT recreate token usage from scenario constants.

It MUST consume the captured trace and reproduce the recorded measurements deterministically.

This mode is intended for CI.

## Real-Model Execution

The real-model runner executes equivalent scenarios under two conditions:

* baseline
* WAM

Both executions must start from equivalent state and use equivalent:

* repository state
* task
* model
* generation parameters
* token budget
* permissions
* environment

When provider-reported token usage is available, it is authoritative.

When provider usage is unavailable, token counts may be calculated from captured request content using an explicitly declared tokenizer.

## Evidence

Each run must record:

* run ID
* scenario
* condition
* execution mode
* provider
* model
* Git SHA
* dirty-tree state
* benchmark version
* scenario version
* runner version
* analyzer version
* token source
* input tokens
* output tokens
* total tokens
* turns
* tool calls
* context rebuilds
* verified requirements
* completion status
* failure/exclusion information

## Savings

The benchmark must calculate:

```text
inputSavingsPct =
  (baselineInputTokens - wamInputTokens)
  / baselineInputTokens * 100

totalSavingsPct =
  (baselineTotalTokens - wamTotalTokens)
  / baselineTotalTokens * 100
```

Negative savings are valid results.

The implementation MUST NOT clamp negative values to zero.

## Verified Progress

Token consumption must be analyzed together with verified progress.

A run that consumes fewer tokens but fails to complete the expected work must not be represented as successful optimization.

## Repeated Runs

Real-model benchmarks MUST support repeated paired runs.

Minimum sample:

```text
N >= 5
```

Recommended sample:

```text
N = 10
```

The report must expose:

* minimum
* p25
* median
* p75
* maximum

Legitimate outliers must remain in the dataset.

Runs may only be excluded with an explicit recorded reason.

## Provenance

The benchmark MUST resolve the actual Git commit SHA.

It MUST NOT report the literal string `HEAD` as provenance.

The evidence must also record whether the working tree was dirty.

## Claims

Reports must classify measurements as:

* observed
* measured
* derived
* estimated

Estimated values must never be presented as provider-observed measurements.

The benchmark must not make universal claims about WAM token savings.

## Output

Each benchmark execution must be able to produce:

```text
raw.json
summary.json
report.md
charts/
```

Raw evidence must remain sufficient to reproduce the summary.

## CI

CI MUST execute deterministic trace replay.

Real-model execution MUST remain opt-in.

CI must validate:

* evidence schema
* deterministic replay
* provenance
* analyzer correctness
* negative savings handling
* baseline/WAM pairing

CI must not require WAM to save tokens in every scenario.

## Non-Goals

This change does not modify:

* WAM runtime behavior
* governance
* task lifecycle
* production functionality
* npm package API
* WAM's existing domain directory structure
