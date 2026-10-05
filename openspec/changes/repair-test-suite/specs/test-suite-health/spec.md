# test-suite-health Specification

## Purpose

Keep the recursive test suite trustworthy: every discovered suite runs, the run terminates within its timeout, and failures are genuine.

## ADDED Requirements

### Requirement: Full suite terminates within the runner timeout

The recursive runner MUST complete the full discovered suite within `WAM_TEST_TIMEOUT_MS` (default 120000ms) and MUST print a summary.

#### Scenario: Full run terminates
- **WHEN** `npm test` runs
- **THEN** it MUST terminate within the timeout and exit 0 only if every suite passed

### Requirement: No hanging suites

No discovered suite SHALL block the runner indefinitely.

#### Scenario: Previously hanging suites complete
- **WHEN** `node --test runtime-guard.test.mjs` and `node --test scripts/wam-audit.test.mjs` run
- **THEN** each MUST exit within 20s

### Requirement: Zero failing suites

All discovered suites MUST pass.

#### Scenario: Context-engine suites pass
- **WHEN** the context-engine suites run
- **THEN** N2 assembly, context classification, routing and graph tests MUST pass

#### Scenario: Execution and verification suites pass
- **WHEN** the execution and verification suites run
- **THEN** observation assessment, gate blocking, hypothesis lifecycle and verification persistence tests MUST pass

#### Scenario: Release and misc suites pass
- **WHEN** the release and misc suites run
- **THEN** release-manager, strategy-capabilities, state-machine and autonomous-task-runner tests MUST pass
