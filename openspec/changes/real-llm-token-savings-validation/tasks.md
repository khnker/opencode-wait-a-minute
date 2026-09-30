# Tasks

## 1. Provider Adapter + Runners
* [ ] Implement OpenAI-compatible provider adapter.
* [ ] Implement `baseline-runner.mjs`.
* [ ] Implement `wam-runner.mjs`.

## 2. Instrumentation
* [x] Instrument `assembly.js` seams (`admissionItems`, `reserve`, `spend`).
* [x] Instrument `runtime/message-handler.js` fast-path/rebuild logic.
* [x] Instrument `context-snapshot.js` for continuation/rebuild.
* [x] Implement file sink for instrumentation counters.

## 3. Evaluation
* [ ] Implement `benchmarks/evaluation/success.mjs`.
* [ ] Implement `benchmarks/evaluation/equivalence.mjs`.

## 4. Metrics/Report
* [ ] Implement `benchmarks/evaluation/metrics.mjs`.
* [ ] Generate `summary.json` with defined metrics.

## 5. Scenarios S7–S30
* [ ] Define S7–S16 (Real-LLM local/contextual).
* [ ] Define S17–S21 (Continuations).
* [ ] Define S22–S26 (Dependency tasks).
* [ ] Define S27–S30 (Negative controls).

## 6. Tests + Validation
* [ ] Add harness unit tests.
* [ ] Run S7–S30 and verify results.
* [ ] Run complete benchmark suite and verify `summary.json`.
