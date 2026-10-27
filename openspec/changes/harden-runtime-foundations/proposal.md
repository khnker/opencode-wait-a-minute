# Change: Harden runtime foundations (gates + evidence)

## Objective
Remove the two failure modes that made WAM unusable on delegated work and
noisy as an evidence source: fabricated blocking assumptions on explicit
prompts, and duplicate metric records.

## Why
Audit of 349 sessions (2026-10-20 → 2026-10-27) and of `.wam/metrics`:

- Every `[router]` dispatch longer than 2000 chars received a synthetic
  contract (`Implementar funcionalidad según la especificación`, `Agregar
  tests`, `Auditar seguridad`) plus assumption A1
  (`El usuario asume que se necesita agregar nueva funcionalidad`).
  The word `add` in the dispatch matched `/agregar|add/`, A1 escalated to
  `DECISION_CRITICAL`, the task entered `ASKING`, and every mutating tool
  (`edit`, `write`, `bash`) was blocked — including inside subagents.
- The security requirement was triggered by the bare word `tokens`
  (`/…|token/`), so token-savings dispatches demanded a security audit.
- `token-savings.json` accumulated 1000 records in ~4 h, dominated by
  near-identical `continuation-*` rows written ~20 ms apart.

## Non-goals
- Does not change which assumptions are considered material.
- Does not make synthetic baselines claimable.
- Does not add an LLM dependency or a tokenizer.
