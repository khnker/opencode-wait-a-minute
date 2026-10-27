# Proposal: Fix deletion-scope question

## Why

`extractPromptCriticalUncertainties` asks "¿Alcance de la eliminación (hard
delete / soft delete / anonymizar)?" whenever the prompt contains
`elim|borr|delet`, even when the request already provides the scope or the
target (e.g. a session URL/ID, "borra el archivo X", "hard delete").

Live example: the user asked about a session URL where deletion was already
explicit; WAM went to ASKING and blocked every tool until U1 was answered.

## What changes

- The deletion-scope question is only emitted when the prompt has no explicit
  scope (`hard/soft delete`, `anonymize`, `permanente/definitivo/irreversible`),
  no explicit target (`borra el archivo/la sesión/el usuario/...`) and no
  concrete reference (URL, path or long ID).
- The migrate-or-delete question is unchanged.

## Impact

- Fewer blocking clarifications for explicit destructive requests.
- Ambiguous requests ("borra los datos") still ask for scope.
