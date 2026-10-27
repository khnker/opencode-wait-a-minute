# Design: Bound noisy N1 context and recompute N2 next action

## Research
- Observed injection: up to 5 stale decisions (~600 chars) + 3 recent sections.
- `src/context/assembly.js`: N1 caps, N2 body, `estTokens`.
- `src/state/task-state.js` <-> `src/integration/orchestration.js` would cycle,
  so the shared next-action helper is a new leaf module.

## Decision
1. New `src/state/next-action.js` (dependency-free) owns `nextActionFrom`;
   `orchestration.js` re-exports it for compatibility. Assembly recomputes the
   N2 next action from `taskState.requirements` instead of trusting
   `taskState.nextAction`.
2. `extractRelevantSections` accepts `maxSections` / `maxCharsPerSection`.
   Decisions: 2 sections, 240 chars each, 500 total. Recent: 2 sections,
   240 chars each.
3. `estTokens` reads `WAM_CHARS_PER_TOKEN` (default 4) so Spanish/code can be
   calibrated without a tokenizer.

## Alternatives considered
- Import `nextActionFrom` from orchestration into assembly: rejected (cycle
  task-state -> orchestration -> task-state).
- Drop N1 entirely: rejected; task-scoped memory is useful.
- Add `js-tiktoken`: rejected (new required dependency, not on the request path).

## Risks
- Fewer decision entries may hide an older relevant decision; the 240-char
  header usually carries the decision.
- `WAM_CHARS_PER_TOKEN` only affects WAM's own estimates, not billing.
