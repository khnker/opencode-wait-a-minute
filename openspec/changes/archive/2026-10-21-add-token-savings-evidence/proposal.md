# Proposal: Add Token Savings Evidence Benchmark

## Problem

WAM is specifically designed to reduce unnecessary context reconstruction and repeated context transmission during long-running agent tasks.

The repository currently contains mechanisms intended to reduce context overhead, but there is no reproducible benchmark that demonstrates:

* how many tokens are consumed by a baseline workflow;
* how many tokens are consumed with WAM;
* where the reduction occurs;
* whether the reduction is caused by context reuse, continuation behavior, skill routing, or other WAM mechanisms;
* whether the observed reduction persists across multiple real model executions.

Without this evidence, token-saving claims remain difficult to reproduce and easy to overstate.

## Goal

Introduce a reproducible token-savings benchmark that produces machine-readable evidence and explanatory graphs.

The benchmark must support two evidence levels:

1. **Deterministic trace benchmark**

   * runs without a real model;
   * executes controlled conversation/tool traces;
   * measures context/token behavior deterministically;
   * can run in CI.

2. **Real-model benchmark**

   * executes identical tasks with WAM disabled and enabled;
   * records provider-reported token usage when available;
   * repeats scenarios to measure variance;
   * produces statistical summaries;
   * is explicitly outside the normal CI path.

## Core principle

The benchmark must measure token consumption together with verified task progress.

A lower token count alone is not evidence of improved efficiency if the baseline performs more useful work or reaches a different completion state.

The primary efficiency metric is therefore:

```text
Verified Progress / 1K Input Tokens
```

Token savings remain a separate metric.

## Scope

This change introduces:

* benchmark scenarios;
* deterministic trace runner;
* baseline/WAM comparison;
* token accounting;
* real-model benchmark adapter;
* raw benchmark evidence;
* statistical analysis;
* graph generation;
* machine-readable JSON output;
* Markdown report;
* regression detection for deterministic benchmarks.

## Non-goals

This change does not:

* modify WAM's runtime orchestration;
* optimize token usage directly;
* introduce a new LLM provider;
* make real-model benchmarks part of mandatory CI;
* claim a universal percentage of token savings;
* treat heuristic audit classifications as token-saving evidence.

## Expected outcome

A benchmark execution produces:

```text
raw traces
    ↓
token measurements
    ↓
baseline/WAM comparison
    ↓
statistical analysis
    ↓
JSON evidence
    ↓
graphs
    ↓
Markdown report
```

The same pipeline must be able to reproduce the reported graph from the raw evidence.
