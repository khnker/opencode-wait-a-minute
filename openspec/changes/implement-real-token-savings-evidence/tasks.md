# Tasks

* [x] Define canonical execution-trace schema.
* [x] Implement trace validation.
* [ ] Capture real baseline execution traces.
* [ ] Capture real WAM execution traces.
* [ ] Capture provider-reported token usage.
* [ ] Implement tokenizer fallback.
* [x] Replace synthetic token calculations.
* [x] Implement deterministic trace replay.
* [x] Implement evidence analyzer.
* [x] Implement paired baseline/WAM execution.
* [ ] Implement real-model runner.
* [x] Implement repeated paired runs.
* [x] Implement min/p25/median/p75/max statistics.
* [x] Resolve actual Git SHA.
* [x] Record dirty-tree state.
* [x] Implement raw evidence output.
* [x] Implement summary output.
* [x] Implement Markdown report.
* [x] Implement token-consumption chart.
* [x] Implement context-consumption chart.
* [x] Implement savings-distribution chart.
* [x] Implement verified-progress chart.
* [x] Add provenance validation.
* [x] Add negative-savings tests.
* [x] Remove tests requiring positive savings.
* [x] Add deterministic replay tests.
* [ ] Add real-model benchmark command.
* [x] Document methodology and claims policy.
* [x] Verify summary can be reproduced from raw evidence.

## Notes

Real-model trace capture (provider usage, tokenizer fallback) and the live
real-model runner are intentionally deferred: `scripts/benchmark/runners/real-model.mjs`
implements the opt-in boundary and sample-size contract, but no provider adapter
is wired. Deterministic trace replay with recorded fixtures is complete and is
what CI executes.
