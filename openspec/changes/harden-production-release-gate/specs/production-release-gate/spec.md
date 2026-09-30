# Production Release Gate

## Requirement: Production gate must validate the release artifact

### Scenario: Clean package installation

* GIVEN the package is built using `npm pack`
* WHEN the generated tarball is installed into a clean directory
* THEN the plugin MUST load successfully
* AND the production smoke test MUST pass

## Requirement: Governance must be release-gated

### Scenario: Unapproved mutation

* GIVEN a contract is not approved
* WHEN a mutating operation is attempted
* THEN the operation MUST be blocked
* AND the production gate MUST pass this invariant

## Requirement: Completion must require evidence

### Scenario: Missing evidence

* GIVEN requirements are not supported by valid evidence
* WHEN completion is attempted
* THEN completion MUST be rejected
* AND the production gate MUST detect the invariant if it regresses

## Requirement: Task isolation must be release-gated

### Scenario: Cross-task authorization

* GIVEN Task A has authorization
* AND Task B is active
* WHEN Task B attempts to use Task A authorization
* THEN the operation MUST be blocked

## Requirement: Audit input must fail closed

### Scenario: Invalid audit configuration

* GIVEN the audit configuration is malformed
* WHEN the audit gate executes
* THEN the audit command MUST fail with a command-error status

## Requirement: Continuation must preserve the fast path

### Scenario: Verified continuation

* GIVEN a task has already reached a state where continuation does not require context reconstruction
* WHEN continuation executes
* THEN the runtime MUST NOT perform a full context rebuild
* AND MUST NOT perform an unnecessary full registry scan

## Requirement: Heuristic audit findings are diagnostic

Behavioral audit classifications MUST NOT independently fail the production gate unless an explicit deterministic threshold contract exists.

## Requirement: Production gate is authoritative

A release MUST NOT be considered production-ready when any deterministic production invariant fails.
