## Why

`npm test` (the recursive 227-suite runner) is red: 23 suites fail and 2 suites hang, and the full run does not complete within the runner's 120s global timeout. These failures are pre-existing and were hidden because `npm test` was never part of the release gate. CHG-001 makes the full suite a required gate stage, so the suite must be green and bounded before the gate can run it.

## What Changes

- Repair the 23 failing suites, grouped by root cause (context engine, execution/verification, release/misc).
- Fix the 2 hanging suites (`runtime-guard.test.mjs`, `scripts/wam-audit.test.mjs`) so the runner terminates.
- Ensure the full run completes well under the runner timeout; raise the default `WAM_TEST_TIMEOUT_MS` only if the healthy run legitimately needs more.
- No plugin runtime behavior change except where a test reveals a real defect; where a test encodes obsolete expectations after the context-engine build, update the test.

## Capabilities

### New Capabilities
- `test-suite-health`: the recursive test runner MUST discover all suites, terminate within its timeout, and exit non-zero only on genuine failures.

### Modified Capabilities
- (none)

## Impact

- failing `*.test.mjs` suites across context, execution, verification and release clusters
- `runtime-guard.test.mjs`, `scripts/wam-audit.test.mjs` (hangs)
- possibly `scripts/run-tests.mjs` (timeout default)
- `scripts/release-gate.mjs` (Test Suite stage becomes viable)
- No new dependencies.
