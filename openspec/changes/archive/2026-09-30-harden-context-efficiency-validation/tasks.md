# Tasks

## Snapshot Matrix

* [x] Add VALID snapshot scenario.
* [x] Add Git STALE scenario.
* [x] Add project-context STALE scenario.
* [x] Add task-state INVALID scenario.
* [x] Add malformed snapshot scenario.
* [x] Add incompatible snapshot-schema scenario.

## Mutation Matrix

* [x] Add isolated git-revision mutation fixture.
* [x] Add isolated relevant-files mutation fixture.
* [x] Add isolated project-context mutation fixture.
* [x] Add isolated task-state mutation fixture.

## Correctness Assertions

* [x] Assert VALID executes fast-path.
* [x] Assert VALID does not perform unnecessary full analysis.
* [x] Assert STALE selects the expected rebuild scope.
* [x] Assert INVALID performs required full rebuild.
* [x] Assert invalid snapshots safely fall back.
* [x] Assert no stale context reaches the final execution.
* [x] Assert verification remains successful.

## Workload Matrix

* [x] Add local workload family.
* [x] Add contextual workload family.
* [x] Add continuation workload family.
* [x] Add negative workload family.
* [x] Add 1/3/5/10/20-turn continuation scenarios.

## Causal Metrics

* [x] Record context rebuild counts.
* [x] Record fast-path counts.
* [x] Record partial rebuild counts.
* [x] Record full rebuild counts.
* [x] Record input/output/total tokens.
* [x] Record verification state.
* [x] Add tokens-per-rebuild metric.
* [x] Add tokens-per-verified-task metric.
* [x] Add rebuild-reduction metric.
* [x] Add input-reduction metric.
* [x] Add total-reduction metric.

## Charts

* [x] Add rebuild-vs-token chart.
* [x] Add savings-by-scenario chart.
* [x] Add continuation-scaling chart.
* [x] Add snapshot-state chart.

## Regression Controls

* [x] Add negative-control regression test.
* [x] Add no-clamping regression test.
* [x] Add false-VALID regression test.
* [x] Add stale-context regression test.

## Reporting & Validation

* [x] Include workload composition in aggregate reports.
* [x] Document interpretation of deterministic evidence.
* [x] Run full deterministic benchmark suite.
