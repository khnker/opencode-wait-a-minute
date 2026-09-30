# Change: Complete Real-Model Token Evidence

## Why

WAM currently has deterministic trace-based evidence demonstrating the expected token-saving mechanism.

That evidence validates the benchmark pipeline and the relationship between context rebuilds and token consumption, but trace-based measurements are not equivalent to provider-reported token usage from real model executions.

This change closes that gap.

The benchmark must be able to execute equivalent baseline and WAM workloads against a real model, capture provider-reported usage when available, verify that both executions completed the same work, and produce reproducible evidence.

## Goal

Establish a reproducible experimental pipeline:

```text
scenario
   │
   ├──────────────┐
   ▼              ▼
baseline          WAM
   │              │
   └──────┬───────┘
          ▼
     raw execution
        traces
          │
     ┌────┴────┐
     ▼         ▼
provider     verification
tokens        result
     │         │
     └────┬────┘
          ▼
       analyzer
          │
          ▼
       evidence
```

## Real-Model Runner

Implement an opt-in real-model runner.

The runner MUST:

1. load a declared scenario;
2. prepare a controlled initial state;
3. execute the baseline;
4. restore the equivalent initial state;
5. execute WAM;
6. capture all available token usage;
7. capture WAM-specific execution events;
8. verify task completion;
9. persist raw evidence.

Real-model execution MUST NOT be required by the normal test suite.

## Paired Execution

Baseline and WAM executions MUST be paired.

A pair MUST use equivalent:

* repository state;
* task;
* model;
* provider;
* generation parameters;
* token limits;
* initial task state;
* relevant environment;
* scenario version.

The benchmark MUST record the pair identifier.

## Provider Token Usage

When the provider reports token usage, the provider value MUST be authoritative.

Capture, where available:

* input tokens;
* output tokens;
* cached input tokens;
* reasoning tokens;
* total tokens;
* provider-specific usage fields.

Unknown provider fields MUST NOT be silently discarded when they may affect interpretation.

If provider usage is unavailable, the run MUST explicitly identify the fallback source.

Supported token sources:

```text
provider
tokenizer
trace
estimated
```

The source MUST be recorded for every token measurement.

## WAM Event Provenance

WAM executions MUST expose sufficient evidence to establish that the optimization mechanism actually executed.

Capture, where available:

* snapshot checks;
* `VALID`;
* `STALE`;
* `INVALID`;
* fast-path executions;
* context assemblies;
* context rebuilds;
* partial rebuilds;
* full rebuilds;
* task verification.

The benchmark MUST NOT infer these events solely from token totals.

## Verification

Both baseline and WAM executions MUST verify the same expected outcome.

The evidence MUST contain:

```text
completionVerified
requirementsVerified
verificationCount
verificationResult
```

A token reduction MUST NOT be reported as successful optimization when the WAM execution failed to complete or verify the expected work.

## Repeated Runs

The runner MUST support repeated paired executions.

Minimum supported sample:

```text
N >= 5
```

The benchmark SHOULD support:

```text
N = 10
```

for production evidence.

The report MUST preserve every valid run.

Statistics MUST include:

* minimum;
* p25;
* median;
* p75;
* maximum.

No outlier may be silently removed.

Excluded runs MUST contain an explicit exclusion reason.

## Provenance

Every run MUST record:

```text
runId
pairId
gitSha
gitDirty
wamVersion
benchmarkVersion
scenarioVersion
traceSchemaVersion
runnerVersion
analyzerVersion
provider
model
generationParameters
timestamp
```

The benchmark MUST resolve the actual Git SHA.

The literal value `HEAD` MUST NOT be used as provenance.

A dirty working tree MUST be explicitly recorded.

## Reproducibility

The benchmark MUST generate:

```text
raw.json
summary.json
report.md
charts/
```

The summary and report MUST be derivable from `raw.json`.

Re-running the analyzer against the same raw evidence MUST produce equivalent metrics.

Real-model execution itself is inherently non-deterministic and MUST NOT be described as byte-for-byte reproducible.

The reproducible artifact is the captured evidence and its analysis.

## Claims

The report MUST distinguish:

### Mechanism evidence

Demonstrated by deterministic traces:

* context rebuild reduction;
* fast-path behavior;
* context/input reduction.

### Provider evidence

Demonstrated by real-model runs:

* provider-reported token usage;
* total token consumption;
* repeated-run distributions.

### Task-efficiency evidence

Requires both:

* token measurements;
* successful verification.

The benchmark MUST NOT claim universal token savings for WAM.

## Negative Results

Negative savings MUST remain valid results.

For example:

```text
baseline = 1500
WAM      = 9000

savings = -500%
```

The benchmark MUST preserve the sign.

No result may be clamped to zero.

## CI

CI MUST continue using deterministic trace replay.

CI MUST validate:

* schema;
* analyzer;
* provenance handling;
* verification logic;
* negative savings;
* paired-run semantics;
* raw-to-summary reproducibility.

Real-model execution MUST remain explicitly opt-in.

## Non-Goals

This change does not:

* modify WAM's runtime optimization algorithm;
* modify context assembly semantics;
* change snapshot invalidation;
* change token accounting inside WAM;
* require a specific model provider;
* require real-model execution in CI.
