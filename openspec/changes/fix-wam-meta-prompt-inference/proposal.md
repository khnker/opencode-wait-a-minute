# Proposal: Fix meta-prompt inference

## Why

Live use showed WAM turning conversational control phrases into contract
requirements:

- "arregla todo, no te detenga, ahora eres responsable de wam de que esta todo bien"
  became three requirements: `Implementar: Todo`, `Implementar: No te detenga`,
  `Implementar: Ahora eres responsable de wam de que esta todo bien`.
- "responde solo: ok" became `Implementar: Responde solo: ok`.

Those requirements are unverifiable, so the completion gate blocks every
response and the session loops between PROPOSED and VALIDACIÓN. WAM must not
fabricate contracts from meta/control language.

## What changes

- Meta-only prompts are classified as `trivial` (no contract, no gate).
- `synthesizeContract` filters meta/control clauses and returns zero
  requirements instead of generic unverifiable fallbacks.
- The completion gate is not applied to trivial/FAST analyses.

## Impact

- Fewer false contracts and less friction for conversational messages.
- No change to real task contracts (specific, actionable prompts still get
  requirements and the evidence gate).
