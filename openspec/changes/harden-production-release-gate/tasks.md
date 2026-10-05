# Tasks

## Package integrity

* [ ] Run `npm pack` from the release build.
* [ ] Install the generated tarball in a clean temporary directory.
* [ ] Load the plugin from the installed artifact.
* [ ] Run package smoke test against the installed artifact.

## Governance

* [ ] Add unapproved mutation test.
* [ ] Add approved capability test.
* [ ] Add ASKING-state governance test.
* [ ] Add DONE-state governance test.
* [ ] Add sub-session governance test.
* [ ] Add task-bound authorization test.

## Completion and evidence

* [ ] Add completion-without-evidence test.
* [ ] Add completion-with-invalid-evidence test.
* [ ] Add valid evidence completion test.
* [ ] Add cross-task evidence test.

## Cognition

* [ ] Include cognition lifecycle invariant in production gate.
* [ ] Verify success/failure experiment closure.
* [ ] Verify legacy cognition migration behavior.

## Task isolation

* [ ] Include runtime isolation suite in production gate.
* [ ] Include stale authorization test.
* [ ] Include interleaved task test.

## Audit contract

* [ ] Include invalid-config test.
* [ ] Include missing-config test.
* [ ] Include invalid-baseline test.
* [ ] Include missing-baseline test.
* [ ] Include baseline regression test.
* [ ] Verify command-error versus regression exit codes.

## Continuation

* [ ] Define observable fast-path counters.
* [ ] Add continuation no-context-rebuild test.
* [ ] Add continuation no-full-registry-scan test.
* [ ] Keep wall-clock benchmark informational rather than authoritative.

## Gate integration

* [ ] Add all deterministic suites to `gate`.
* [ ] Ensure production gate reports each layer independently.
* [ ] Ensure any deterministic failure produces a non-zero exit code.
* [ ] Ensure heuristic audit classifications do not independently fail release.

## Final verification

* [ ] Run complete test suite.
* [ ] Run `gate`.
* [ ] Run package verification.
* [ ] Run `npm pack` and clean-install verification.
* [ ] Confirm release artifact contains all required runtime files.
* [ ] Confirm release gate passes from a clean checkout.
