# Change: Implement Real Token Savings Evidence

## Why

The current token-savings benchmark provides a deterministic estimator based on hardcoded scenario parameters.

The benchmark is useful as a smoke test, but it does not constitute evidence that WAM actually reduces token consumption during real execution.

The current implementation calculates token usage from formulas such as:

* turns × estimated tokens per turn
* context rebuilds × estimated context size
* fixed WAM overhead

This can validate the benchmark machinery, but it cannot support claims about actual WAM token savings.

The benchmark must therefore be changed to measure real execution traces and provider-reported token usage when available.

## What Changes

This change replaces the current synthetic token model with an evidence pipeline based on real execution data.

The benchmark will support two execution modes:

1. Deterministic trace replay
2. Real-model execution

Both modes will use the same evidence schema and analysis pipeline.

### Deterministic trace replay

A previously captured execution trace is replayed through the analyzer.

This mode must be:

* deterministic
* network independent
* suitable for CI
* suitable for regression detection

It must not fabricate token counts from fixed scenario formulas.

### Real-model execution

An opt-in runner executes the same scenario with:

* baseline
* WAM

under equivalent conditions.

When the provider exposes token usage, that usage is the authoritative source.

If provider usage is unavailable, the benchmark may calculate token counts from captured request payloads using the declared tokenizer.

Estimated values must never be presented as provider-observed values.

## Evidence Requirements

Each benchmark result must preserve:

* scenario
* execution mode
* baseline/WAM condition
* model/provider
* run identifier
* repository commit
* dirty-tree state
* timestamp
* token source
* input tokens
* output tokens
* total tokens
* turns
* tool calls
* context rebuilds
* verified progress
* completion state
* exclusions/failures

## Comparison Requirements

Baseline and WAM executions must use equivalent:

* repository state
* task
* initial conditions
* model
* generation settings
* token budget
* permissions
* environment

The benchmark must not intentionally degrade the baseline to create an artificial token-saving advantage.

## Statistical Requirements

Real-model benchmarks must support repeated runs.

Minimum:

* N >= 5

Recommended:

* N = 10

The report must provide:

* minimum
* p25
* median
* p75
* maximum

Legitimate outliers must remain in the evidence.

Runs may only be excluded when the exclusion reason is explicitly recorded.

## Savings

The benchmark must calculate:

```text
inputSavingsPct =
  (baselineInput - wamInput) / baselineInput * 100

totalSavingsPct =
  (baselineTotal - wamTotal) / baselineTotal * 100
```

Negative savings are valid evidence.

The benchmark must never clamp negative savings to zero.

## Verified Progress

Token reduction alone is insufficient.

The benchmark must also record whether the execution produced the expected verified outcome.

The report must therefore distinguish:

* token consumption
* verified progress
* completion

A lower token count with incomplete work must not be reported as successful token optimization.

## Provenance

Every evidence set must identify the exact repository state.

The benchmark must record:

* actual Git commit SHA
* dirty-tree status
* benchmark version
* scenario version
* runner version
* analyzer version
* model/provider when applicable

`HEAD` must not be used as a substitute for the actual resolved SHA.

## Claims Policy

Benchmark reports must distinguish:

* `observed`: directly reported by the provider or execution trace
* `measured`: calculated from captured execution data
* `derived`: calculated from measured values
* `estimated`: inferred using a declared estimator

Estimated data must not be represented as observed or measured.

## Output

The benchmark must produce:

```text
raw.json
summary.json
report.md
charts/
```

The raw evidence must remain available so that reported numbers can be independently re-analyzed.

## Non-Goals

This change does not:

* redesign WAM's runtime lifecycle
* change WAM governance semantics
* optimize the WAM runtime itself
* claim a universal token-saving percentage
* make real-model benchmarks mandatory in CI
