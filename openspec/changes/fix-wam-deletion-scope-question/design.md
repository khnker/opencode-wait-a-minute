# Design: Fix deletion-scope question

## Decision

In `extractPromptCriticalUncertainties`, gate the deletion-scope question on
three signals:

1. **Explicit scope**: `hard delete`, `soft delete`, `anonymize/anonimizar`,
   `permanente`, `definitivo`, `irreversible`.
2. **Explicit target**: an imperative delete/remove followed by a determiner or
   a known object (`archivo`, `sesión`, `usuario`, `registro`, `fila`, ...).
3. **Concrete reference**: a URL, a path with at least two segments, or a long
   ID (>=16 chars).

If any signal is present, the target/scope is already concrete enough; do not
ask. Only truly ambiguous prompts (`borra los datos`, `elimina eso`) emit the
question.

## Trade-off

A prompt that names the target but not the deletion mode will not be asked
about hard/soft delete. That is acceptable: the request is explicit about what
to delete, and the model can choose the safest default or ask in its own
response without blocking every tool.

## Non-goals

- Do not change the migrate-or-delete branch.
- Do not change how non-deletion uncertainties are classified.
