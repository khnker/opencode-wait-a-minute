# Tasks

## Implementation
- [x] Define exactly what is versioned (schema/templates) vs ignored (tasks, active-task, logs, temporary context, generated evidence).
- [x] Add/repair `.gitignore` entries for transient `.wam/` state.
- [x] Ensure `.wam/` is excluded from `npm pack` surface.
- [x] Document `.wam/` layout and lifecycle.
- [x] `git status` stays clean after a local run that writes task/log/evidence state.
- [x] `npm pack --dry-run` contains no `.wam/` runtime artifacts.
- [x] Documentation describes versioned vs ignored paths.

## Validation
- [x] Run the change's objective validation and paste the output.
- [x] `openspec validate rc1-22-wam-runtime-state-isolation --strict` passes.
