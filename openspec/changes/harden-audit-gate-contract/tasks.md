# Tasks

## Implementation

* [ ] Validate explicit `--config` path before reading configuration.
* [ ] Reject invalid JSON configuration.
* [ ] Validate configuration schema.
* [ ] Validate explicit `--baseline` path.
* [ ] Reject invalid JSON baseline.
* [ ] Validate baseline structure.
* [ ] Refactor gate evaluation so it is calculated independently from CLI enforcement.
* [ ] Include gate evaluation in audit JSON when available.
* [ ] Preserve distinct exit codes for command failure and regression.
* [ ] Ensure baseline comparison never mutates baseline data.

## Tests

* [ ] Add missing-config test.
* [ ] Add invalid-config test.
* [ ] Add missing-baseline test.
* [ ] Add invalid-baseline test.
* [ ] Add baseline-without-gate test.
* [ ] Add threshold-failure test.
* [ ] Add baseline-regression test.
* [ ] Assert JSON gate output.
* [ ] Assert process exit codes.

## OpenSpec reconciliation

* [ ] Reconcile the existing `wam-audit-regression-gate` task list with actual implementation.
* [ ] Verify every completed task with automated evidence.
* [ ] Leave incomplete tasks explicitly unchecked.

## Verification

* [ ] Run focused audit tests.
* [ ] Run the complete test suite.
* [ ] Run `production-gate`.
* [ ] Verify malformed inputs fail closed.
* [ ] Verify valid regression returns the regression exit code.
