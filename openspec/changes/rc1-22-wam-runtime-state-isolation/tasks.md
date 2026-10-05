# Tasks

## Implementation
- [ ] Define exactly what is versioned (schema/templates) vs ignored (tasks, active-task, logs, temporary context, generated evidence).
- [ ] Add/repair `.gitignore` entries for transient `.wam/` state.
- [ ] Ensure `.wam/` is excluded from `npm pack` surface.
- [ ] Document `.wam/` layout and lifecycle.
- [ ] `git status` stays clean after a local run that writes task/log/evidence state.
- [ ] `npm pack --dry-run` contains no `.wam/` runtime artifacts.
- [ ] Documentation describes versioned vs ignored paths.

## Validation
- [ ] Run the change's objective validation and paste the output.
- [ ] `openspec validate rc1-22-wam-runtime-state-isolation --strict` passes.
