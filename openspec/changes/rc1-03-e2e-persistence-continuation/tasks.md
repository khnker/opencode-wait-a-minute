# Tasks

## Implementation
- [ ] Simulate: session 1 creates a task -> interrupt -> terminate process -> session 2 recovers state and continues.
- [ ] Assert NO: duplicated task, lost state, unnecessary restart, false DONE, new `.wam/tasks/*` for the same task.
- [ ] Same task id after resume.
- [ ] No duplicate `.wam/tasks/*`.
- [ ] State preserved.
- [ ] No unnecessary rebuild.
- [ ] No false DONE.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-03-e2e-persistence-continuation --strict` passes.
