# Tasks

## Runtime scope

* [ ] Define runtime scope representation.
* [ ] Resolve session/task identity at governed operation boundaries.
* [ ] Remove authorization dependence on ambient task state.
* [ ] Bind authorization to session + task.
* [ ] Ensure task switching reloads task-specific state.
* [ ] Prevent stale task authorization reuse.

## State isolation

* [ ] Verify cognition state is task-local.
* [ ] Verify requirement state is task-local.
* [ ] Verify evidence is task-local.
* [ ] Verify completion state is task-local.
* [ ] Verify governance state is task-local.

## Sub-sessions

* [ ] Define explicit parent/child scope.
* [ ] Define capability inheritance rules.
* [ ] Ensure sub-sessions cannot bypass governance.
* [ ] Add parent/child task mismatch tests.

## Concurrency

* [ ] Add interleaved two-task runtime test.
* [ ] Add concurrent task state mutation test.
* [ ] Add stale authorization test.
* [ ] Add cross-task evidence test.

## Verification

* [ ] Run focused isolation tests.
* [ ] Run complete test suite.
* [ ] Run production gate.
* [ ] Verify no cross-task authorization is possible.
