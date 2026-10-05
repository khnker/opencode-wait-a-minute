# Design: Runtime State Isolation (.wam)

## Approach
`.wam/` mixes runtime/user state with repository content, risking local runs contaminating the repo and leaking into packages.

## Scope
- Define exactly what is versioned (schema/templates) vs ignored (tasks, active-task, logs, temporary context, generated evidence).
- Add/repair `.gitignore` entries for transient `.wam/` state.
- Ensure `.wam/` is excluded from `npm pack` surface.
- Document `.wam/` layout and lifecycle.

## Validation Strategy
- `git status` stays clean after a local run that writes task/log/evidence state.
- `npm pack --dry-run` contains no `.wam/` runtime artifacts.
- Documentation describes versioned vs ignored paths.

## Risks
- Structural/behavioral coupling: keep this change focused on its stated outcome.
- Silent pass: validation MUST fail closed on missing/ambiguous input.
