# Change: Real-LLM Token-Savings Validation

## Why

WAM's current benchmark infrastructure relies on deterministic traces, which are essential for regression testing but fail to capture emergent behaviors, token-cost scaling, and real-world performance characteristics of LLM-based systems operating with stochasticity.

We need to validate that WAM's token-savings mechanisms (assembly levels, snapshotting, fast-path routing) actually deliver value when applied to non-deterministic, long-running real-world LLM interactions.

## What Changes

Create an instrumentation, runner, and evaluation harness to benchmark WAM against real-LLM tasks.

This change is **instrumentation + runner + evaluation ONLY; it MUST NOT modify WAM's central mechanism** (assembly levels, snapshot/hash, fast-path, CLAIM→ACTION→OBSERVATION→EVIDENCE→VERIFIED cognition/execution).

### Instrumentation
We will instrument the core runtime to emit performance and token-usage telemetry without altering operational behavior.

### Harness & Runner
We introduce an in-process runner that routes tasks through WAM's assembly pipeline, measuring token usage via provider-reported metrics or tokenizer fallback.

### Evaluation
We establish an equivalence and success-evaluation framework to verify that WAM's optimization doesn't degrade task performance or semantic output quality.

### Scenario Expansion
We expand the scenario set from deterministic regression (S1–S6) to include:
* S7–S16: Real-LLM local/contextual tasks.
* S17–S21: Continuation tasks.
* S22–S26: Dependency tasks.
* S27–S30: Negative controls.
