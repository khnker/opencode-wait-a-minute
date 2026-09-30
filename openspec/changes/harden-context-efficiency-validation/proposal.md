# Change: Harden Context Efficiency Validation

## Why

The current deterministic benchmark demonstrates that WAM can reduce context rebuilding and token consumption in representative traces.

The remaining risk is correctness of the optimization itself.

The benchmark must explicitly exercise the snapshot state machine:

```text
VALID
STALE
INVALID
```

and verify that WAM never uses the fast-path when relevant context has become obsolete.

The benchmark must also cover workloads where WAM's fixed overhead is expected to dominate.

## Goal

Validate the causal mechanism:

```text
snapshot state
      ↓
continuation decision
      ↓
context reconstruction
      ↓
token consumption
      ↓
verified task result
```

## Snapshot Matrix

The benchmark MUST include at least:

### VALID

No relevant state changed.

Expected:

```text
fast-path
no unnecessary context rebuild
```

### STALE — Git

Git revision changed while task state remains valid.

Expected:

```text
STALE
partial or required rebuild
no stale context reuse
```

### STALE — Project Context

Relevant project context changed.

Expected:

```text
STALE
project-context rebuild
```

### INVALID — Task State

Task state changed.

Expected:

```text
INVALID
full rebuild
```

### Invalid Snapshot

Snapshot is malformed, missing required fields, or incompatible with the current schema.

Expected:

```text
safe fallback
no fast-path
```

## Mutation Matrix

Scenarios MUST explicitly mutate one state dimension at a time:

```text
gitRevision
relevantFilesHash
projectContextHash
taskStateHash
```

The benchmark MUST verify that unrelated mutations do not unnecessarily invalidate the snapshot.

## Fast-Path Correctness

For every `VALID` scenario the benchmark MUST verify:

* snapshot classified as `VALID`;
* fast-path executed;
* live task state was re-emitted;
* full context analysis was not executed unnecessarily;
* verification remained successful.

## Invalidation Correctness

For every stale/invalid scenario the benchmark MUST verify:

* expected classification;
* expected rebuild scope;
* no stale project context was reused;
* final verification succeeded.

A false `VALID` result MUST fail the benchmark.

## Workload Matrix

The benchmark SHOULD include four workload families:

```text
local
contextual
continuation
negative
```

### Local

Small tasks with minimal context.

Purpose:

measure WAM fixed overhead.

### Contextual

Tasks requiring project/domain context.

Purpose:

measure selective assembly.

### Continuation

Multi-turn tasks with repeated context requests.

Purpose:

measure snapshot fast-path and avoided rebuilds.

### Negative

Tasks where WAM overhead exceeds context savings.

Purpose:

validate that the benchmark preserves negative results.

## Scaling

The continuation workload SHOULD vary the number of turns:

```text
1
3
5
10
20
```

The objective is not to prove a particular percentage.

The objective is to observe whether avoided rebuilds correlate with reduced context consumption.

## Causal Metrics

Every scenario MUST expose:

```text
turns
contextRebuilds
fastPathCount
partialRebuildCount
fullRebuildCount
inputTokens
outputTokens
totalTokens
verification
```

The report SHOULD expose:

```text
tokens per rebuild
tokens per verified task
rebuild reduction %
input reduction %
total reduction %
```

## Regression Controls

The benchmark MUST contain explicit assertions for:

* no false `VALID`;
* no skipped required rebuild;
* no stale task state;
* no stale project context;
* no lost verification;
* no negative-savings clamping.

The benchmark MUST NOT assert that WAM always saves tokens.

## Charts

Generate at least:

### Rebuild vs Token Cost

Show context rebuild count alongside input-token consumption.

### Savings by Scenario

Show positive and negative results without removing controls.

### Continuation Scaling

Show token consumption as the number of turns increases.

### Snapshot State

Show the number of executions classified as:

```text
VALID
STALE
INVALID
```

## Aggregation

Aggregated savings MUST be reported together with workload composition.

The report MUST state:

* number of scenarios;
* number of runs;
* number of negative controls;
* verification success;
* token source.

A single aggregate percentage MUST NOT be presented without this context.

## Non-Goals

This change does not:

* modify snapshot semantics;
* modify the context assembly algorithm;
* modify WAM runtime behavior;
* optimize token accounting;
* add a provider-specific runner.

It validates existing behavior.
