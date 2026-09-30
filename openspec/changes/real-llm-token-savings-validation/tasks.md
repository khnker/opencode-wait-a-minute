# Tasks

## 1. Provider Adapter + Runners
* [x] Implement OpenAI-compatible provider adapter.
* [x] Implement `baseline-runner.mjs` (raw context via `buildRuntimeContextGraph`).
* [x] Implement `wam-runner.mjs` + `real-session.mjs` (multi-turn, instrumentation).
* [x] Ground scenarios in real graph inputs so baseline > assembled (see §5) — REQUIRED before savings are meaningful.

## 2. Instrumentation
* [x] Instrument `assembly.js` seams (`admissionItems`, `reserve`, `spend`).
* [x] Instrument `runtime/message-handler.js` fast-path/rebuild logic.
* [x] Instrument `context-snapshot.js` for continuation/rebuild.
* [x] Implement file sink for instrumentation counters.

## 3. Evaluation
* [x] Implement `benchmarks/evaluation/success.mjs`.
* [x] Implement `benchmarks/evaluation/equivalence.mjs`.

## 4. Metrics/Report
* [x] Implement `benchmarks/evaluation/metrics.mjs`.
* [x] Generate `summary.json` with defined metrics.

## 5. Scenarios S7–S30
* [x] Define S7–S16 (Real-LLM local/contextual).
* [x] Define S17–S21 (Continuations).
* [x] Define S22–S26 (Dependency tasks).
* [x] Define S27–S30 (Negative controls).

## 6. Tests + Validation
* [x] Add harness unit tests.
* [ ] Run S7–S30 and verify results.
* [ ] Run complete benchmark suite and verify `summary.json`.
