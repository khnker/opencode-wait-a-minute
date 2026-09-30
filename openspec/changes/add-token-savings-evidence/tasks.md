# Tasks

## 1. Benchmark infrastructure

* [ ] Create token benchmark directory structure.
* [ ] Define benchmark scenario schema.
* [ ] Define execution result schema.
* [ ] Define benchmark version.
* [ ] Record git commit and timestamp for every result.

## 2. Deterministic runner

* [ ] Implement deterministic trace runner.
* [ ] Implement baseline execution mode.
* [ ] Implement WAM execution mode.
* [ ] Ensure both modes consume equivalent scenario inputs.
* [ ] Record turns.
* [ ] Record tool calls.
* [ ] Record context rebuilds.
* [ ] Record registry scans.
* [ ] Record continuation count.
* [ ] Record verified requirements.
* [ ] Record completion status.

## 3. Token accounting

* [ ] Implement input-token accounting.
* [ ] Implement output-token accounting.
* [ ] Implement total-token accounting.
* [ ] Distinguish provider measurements from estimates.
* [ ] Implement token savings calculation.
* [ ] Preserve negative savings.
* [ ] Implement verified-progress calculation.
* [ ] Implement verified-progress-per-1K-input-token metric.

## 4. Benchmark scenarios

* [ ] Implement S1 simple task.
* [ ] Implement S2 multi-step implementation.
* [ ] Implement S3 failed implementation/retry.
* [ ] Implement S4 long-running continuation.
* [ ] Implement S5 multi-task/session switching.
* [ ] Verify scenarios do not accidentally share task state.

## 5. Deterministic regression

* [ ] Define deterministic benchmark reference format.
* [ ] Implement configurable regression threshold.
* [ ] Compare current result against reference.
* [ ] Fail benchmark when configured regression is exceeded.
* [ ] Add deterministic benchmark to CI.
* [ ] Ensure CI requires no external provider credentials.

## 6. Real-model runner

* [ ] Define real-model benchmark interface.
* [ ] Implement provider token usage extraction.
* [ ] Add explicit real-model execution command.
* [ ] Require credentials/configuration explicitly.
* [ ] Fail clearly when credentials are missing.
* [ ] Prevent silent fallback to deterministic mode.
* [ ] Record model/provider metadata.
* [ ] Record all relevant generation configuration.

## 7. Repeated runs

* [ ] Implement configurable run count.
* [ ] Default real benchmark sample size to at least 5.
* [ ] Support 10-run evidence collection.
* [ ] Implement paired baseline/WAM execution.
* [ ] Preserve valid outliers.
* [ ] Exclude only documented infrastructure failures.

## 8. Analysis

* [ ] Implement minimum calculation.
* [ ] Implement p25 calculation.
* [ ] Implement median calculation.
* [ ] Implement p75 calculation.
* [ ] Implement maximum calculation.
* [ ] Calculate per-run savings.
* [ ] Calculate aggregate savings.
* [ ] Calculate verified-progress efficiency.
* [ ] Preserve baseline/WAM completion differences.

## 9. Graph generation

* [ ] Generate token-consumption graph.
* [ ] Generate iteration/context graph.
* [ ] Generate repeated-run distribution graph.
* [ ] Generate verified-progress efficiency graph.
* [ ] Generate graphs exclusively from JSON evidence.
* [ ] Make graph generation reproducible.
* [ ] Include scenario and execution mode in graph metadata.

## 10. Reports

* [ ] Generate machine-readable `raw.json`.
* [ ] Generate normalized `summary.json`.
* [ ] Generate Markdown report.
* [ ] Include benchmark provenance.
* [ ] Include methodology.
* [ ] Include token measurements.
* [ ] Include savings calculations.
* [ ] Include completion/verification status.
* [ ] Include distribution statistics.
* [ ] Distinguish observed, estimated and derived values.

## 11. Documentation

* [ ] Document deterministic benchmark usage.
* [ ] Document real-model benchmark usage.
* [ ] Document required credentials.
* [ ] Document reproducibility limitations.
* [ ] Document statistical interpretation.
* [ ] Document claims policy.
* [ ] Add generated evidence example to documentation.

## 12. Validation

* [ ] Run deterministic benchmark from clean checkout.
* [ ] Run deterministic benchmark twice and compare results.
* [ ] Run deterministic regression check.
* [ ] Run complete existing test suite.
* [ ] Run production gate.
* [ ] Execute at least one real-model scenario manually.
* [ ] Execute at least 5 paired real-model runs.
* [ ] Generate final graphs from raw evidence.
* [ ] Verify graphs match JSON values.
* [ ] Verify failed/negative-savings cases are represented correctly.

## 13. Release evidence

* [ ] Produce first real benchmark dataset.
* [ ] Preserve raw benchmark artifacts.
* `[ ] Produce summary report.
* [ ] Produce graphs.
* [ ] Review claims against measured evidence.
* [ ] Do not publish universal savings claims from a single scenario.
