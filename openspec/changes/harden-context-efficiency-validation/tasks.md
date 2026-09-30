# Tasks

## Snapshot Matrix

* [ ] Add VALID snapshot scenario.
* [ ] Add Git STALE scenario.
* [ ] Add project-context STALE scenario.
* [ ] Add task-state INVALID scenario.
* [ ] Add malformed snapshot scenario.
* [ ] Add incompatible snapshot-schema scenario.

## Mutation Matrix

* [ ] Add isolated git-revision mutation fixture.
* [ ] Add isolated relevant-files mutation fixture.
* [ ] Add isolated project-context mutation fixture.
* [ ] Add isolated task-state mutation fixture.

## Correctness Assertions

* [ ] Assert VALID executes fast-path.
* [ ] Assert VALID does not perform unnecessary full analysis.
* [ ] Assert STALE selects the expected rebuild scope.
* [ ] Assert INVALID performs required full rebuild.
* [ ] Assert invalid snapshots safely fall back.
* [ ] Assert no stale context reaches the final execution.
* [ ] Assert verification remains successful.

## Workload Matrix

* [ ] Add local workload family.
* [ ] Add contextual workload family.
* [ ] Add continuation workload family.
* [ ] Add negative workload family.
* [ ] Add 1/3/5/10/20-turn continuation scenarios.

## Causal Metrics

* [ ] Record context rebuild counts.
* [ ] Record fast-path counts.
* [ ] Record partial rebuild counts.
* [ ] Record full rebuild counts.
* [ ] Record input/output/total tokens.
* [ ] Record verification state.
* [ ] Add tokens-per-rebuild metric.
* [ ] Add tokens-per-verified-task metric.
* [ ] Add rebuild-reduction metric.
* [ ] Add input-reduction metric.
* [ ] Add total-reduction metric.

## Charts

* [ ] Add rebuild-vs-token chart.
* [ ] Add savings-by-scenario chart.
* [ ] Add continuation-scaling chart.
* [ ] Add snapshot-state chart.

## Regression Controls

* [ ] Add negative-control regression test.
* [ ] Add no-clamping regression test.
* [ ] Add false-VALID regression test.
* [ ] Add stale-context regression test.

## Reporting & Validation

* [ ] Include workload composition in aggregate reports.
* [ ] Document interpretation of deterministic evidence.
* [ ] Run full deterministic benchmark suite.
