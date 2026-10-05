# Change: Runtime State Isolation (.wam)

## Why
`.wam/` mixes runtime/user state with repository content, risking local runs contaminating the repo and leaking into packages.

## What Changes
- Define exactly what is versioned (schema/templates) vs ignored (tasks, active-task, logs, temporary context, generated evidence).
- Add/repair `.gitignore` entries for transient `.wam/` state.
- Ensure `.wam/` is excluded from `npm pack` surface.
- Document `.wam/` layout and lifecycle.

## Non-goals
- Versioning user task data.
- Shipping `.wam/` runtime state in the package.

## Expected Result
`.wam/` is unambiguously runtime state: transient artifacts are gitignored and never packed.

## Validation
- [ ] `git status` stays clean after a local run that writes task/log/evidence state.
- [ ] `npm pack --dry-run` contains no `.wam/` runtime artifacts.
- [ ] Documentation describes versioned vs ignored paths.

## Program
- RC1 item: RC1-22 (A)
- Priority: P0
