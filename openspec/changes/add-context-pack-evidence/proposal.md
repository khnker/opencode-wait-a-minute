# Proposal: Context Pack Evidence

## Problem

`assembleContext()` selects the N0/N1/N2/N3 slice that is injected into each
turn and emits `pack.lines`, but nothing persists that pack. Today `.wam`
contains only:

- `.wam/tasks/<taskId>/context.md` — live task state (requirements/next), overwritten per turn;
- `.wam/snapshots/` — hashes used for invalidation;
- `.wam/traces/<traceId>.json` — skill selection decisions.

There is no record of what was actually sent to the model on a given turn, what
was dropped by the budget/admission policy, or in what order turns occurred.
The claim "only the task-relevant portion was sent, the rest is archived" is
therefore not verifiable.

## Goal

Persist one ordered, immutable artifact per assembled pack under
`.wam/tasks/<taskId>/context/`, plus an ordered `index.json` manifest.

Each record keeps:

- the prompt and prompt hash;
- budget, budget used and violation flag;
- the injected lines (the exact slice sent);
- the dropped items with their admission reason;
- the integrity report (selected/emitted/omitted counts, sufficiency);
- the full candidate pool (`id`/`type`/`content`/`verified`), including nodes
  the router omitted.

## Non-goals

- Replacing `.wam/tasks/<taskId>/context.md` (that is live state, not evidence).
- Archiving the full context graph on every turn; only the candidate nodes
  considered for the pack are stored.
- Changing selection or budget behaviour.
