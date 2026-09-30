# Design: Real-LLM Token-Savings Validation

## Scope
* Language: JavaScript ESM (`.mjs`), zero new runtime dependencies.
* Provider: OpenAI-compatible adapter over global `fetch`, gated by env `WAM_BENCH_BASE_URL`, `WAM_BENCH_API_KEY`, `WAM_BENCH_MODEL`.
* Trace-replay remains the CI default; real-path is opt-in.

## Harness
In-process runner.
1. `baseline-runner`: Executes raw/contextual prompt.
2. `wam-runner`: Routes the same task through WAM's assembly/snapshot pipeline with instrumentation enabled.
3. Token counts: From provider usage or tokenizer fallback.
4. `repoCommit`: Recorded from `git rev-parse HEAD`.

## Instrumentation
Reuse existing seams:
* `assembly.js`: `admissionItems`, `reserve`, `spend` (root path).
* `runtime/message-handler.js`: VALID fast-path / STALE rebuild.
* `context-snapshot.js`: `checkContinuation`, `rebuildScope`.
* Optional `collector` param on those seams (`benchmarks/instrumentation/collector.mjs`), with `benchmarks/instrumentation/file-sink.mjs` writing counters; behavior is identical when no collector is passed.

Counters: `Context_assembled`, `Context_reconstructed`, `Context_fast_path`, `Snapshot_hit`, `Snapshot_miss`, `Mandatory_items`, `Conditional_items`, `Optional_items`, `Tokens_before`, `Tokens_after`, `Reconstruction_count`.

## Evaluation
`benchmarks/evaluation/{success,equivalence}.mjs`.
* Success: Tests pass, expected files modified, expected behavior, no regressions, evidence available.
* Equivalence: Semantic matching.
Output: `{success, equivalent, testsPassed, filesExpected}`.

## Metrics
Metrics added to `summary.json`: `TokenReductionPct`, `SuccessfulTasks`, `SuccessRate`, `EquivalenceRate`, `ReconstructionReductionPct`, `FastPathRate`, `TokensPerSuccessfulTask`.
Primary metric = tokens per successfully completed task.

## Scenarios
S1–S6 (Deterministic regression suite, preserved).
S7–S16 (Real-LLM local/contextual), S17–S21 (Continuations), S22–S26 (Dependency), S27–S30 (Negative).

Record shape example:
```json
{
  "repoCommit": "a1b2c3d...",
  "model": "gpt-4o",
  "scenario": "S7",
  "tokens": 1234,
  ...
}
```

## Target Tree
```text
benchmarks/
├── scenarios/
│   ├── local/
│   ├── contextual/
│   ├── continuation/
│   └── negative/
├── runners/
│   ├── baseline-runner.mjs
│   └── wam-runner.mjs
├── evaluation/
│   ├── equivalence.mjs
│   ├── success.mjs
│   └── metrics.mjs
├── providers/
└── results/
```
