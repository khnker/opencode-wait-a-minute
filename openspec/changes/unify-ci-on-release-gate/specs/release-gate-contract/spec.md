# release-gate-contract Specification

## Purpose

Define the canonical release gate command, require CI and release workflows to run it, require the OpenCode E2E to assert a real model round-trip, and retire the legacy production gate script.

## ADDED Requirements

### Requirement: Canonical release gate command

`npm run gate` MUST execute `scripts/release-gate.mjs`. The `gate`, `rc1`, `validate`, and `production:gate` npm scripts MUST all resolve to the same script so there is a single release contract.

#### Scenario: All aliases resolve to the unified gate
- **WHEN** a developer runs `npm run gate`, `npm run rc1`, `npm run validate`, or `npm run production:gate`
- **THEN** each MUST invoke `scripts/release-gate.mjs`

### Requirement: CI parity with the release gate

Pull-request and release workflows MUST run the canonical `npm run gate`.

#### Scenario: Pull-request CI runs the gate
- **WHEN** a pull request targets `main`
- **THEN** CI MUST run `npm run gate` with `WAM_SKIP_OPENCODE_E2E=1`

#### Scenario: Release workflow runs the gate
- **WHEN** a release tag is pushed
- **THEN** the release workflow MUST run `npm run gate` before publishing

### Requirement: OpenCode E2E MUST assert the model round-trip

The OpenCode smoke E2E MUST assert that the model produced the expected answer. A clean process exit alone MUST NOT be treated as success.

#### Scenario: Expected answer present
- **WHEN** the spawned `opencode run` output contains the expected answer
- **THEN** the E2E MUST report success with exit code 0

#### Scenario: No answer produced
- **WHEN** `opencode` exits cleanly without producing the expected answer
- **THEN** the E2E MUST fail with a non-zero exit code

#### Scenario: No provider available
- **WHEN** `WAM_SKIP_OPENCODE_E2E=1` is set OR the `opencode` binary is not in `PATH`
- **THEN** the E2E MUST skip and exit with code 0

### Requirement: Legacy production gate MUST be retired

`scripts/production-gate.mjs` MUST be removed, and its test suites MUST remain covered by `npm test`.

#### Scenario: No references to the legacy gate
- **WHEN** the repository is searched for `production-gate.mjs`
- **THEN** no workflow, package script, or source file MUST reference it

#### Scenario: Legacy suites still run
- **WHEN** `npm test` executes
- **THEN** the suites formerly listed by the legacy gate MUST still be discovered and run
