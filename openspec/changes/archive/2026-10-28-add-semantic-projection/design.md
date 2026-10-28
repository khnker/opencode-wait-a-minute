## Context

Compaction receives a transcript and a task snapshot. Today `buildContextBrief` renders a
flat summary from `taskState`, decisions and entities. The model then decides what survives
compaction. Meanwhile the plugin already stores event-sourced execution state (ledger),
versioned canonical base, hierarchy constraints and canonical deltas. Re-deriving those
facts from the transcript duplicates the source of truth and makes compaction lossy.

## Research

- W3C PROV-DM — provenance entities/activities/agents and derivation:
  https://www.w3.org/TR/prov-dm/
- Anthropic, effective context engineering for AI agents — structured, bounded working
  state instead of transcript replay:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Martin Fowler, Event Sourcing — project read models from an append-only event log:
  https://martinfowler.com/eaaDev/EventSourcing.html

## Alternatives Considered

### A. Keep asking the model to summarize the transcript

Rejected: non-deterministic, drops evidence refs, cannot be tested, and lets the model
rewrite execution state that the ledger already owns.

### B. Rewrite `assembly.js` selection now

Rejected for this change: assembly owns MANDATORY/CONDITIONAL/OPTIONAL selection and its
16000-char budget. Changing it in the same step couples compaction to prompt assembly and
widens the diff. The projection has a single integration point today (the brief) and can
feed assembly later without changing its interface.

### Chosen: pure projection + optional brief integration

`buildSemanticProjection` maps structured state to a bounded, deterministic object;
`renderSemanticProjection` renders it with headings and a `maxChars` cap. The brief uses it
only when a ledger or base is available. The renderer receives `truncate` from the caller
to avoid a circular import between brief and projection.

## Decisions

- Projection is pure: no disk I/O, no clock, no randomness. Loaders stay in callers.
- Ordering is explicit: requirements/pending/conflicts come from `projectExecution` (already
  sorted); decisions keep input order; refs are deduped and sorted.
- Only live decisions are projected (`accepted`, `approved`); `rejected`, `superseded`,
  `invalidated`, `proposed`, `draft` are excluded by whitelist.
- Evidence is emitted as refs (`id`/`ref`/`path`), never as full text.
- Caps are bounded (`CAPS`) and omitted ids/sources move to `retrievableRefs`.
- **Fallback rule**: missing ledger and missing base → legacy brief unchanged. Projection
  errors are caught and silently fall back; the hook never throws.

## Risks / Trade-offs

- Ledger and base can drift from `taskState`; projection prefers the ledger when present.
- `retrievableRefs` only names refs; retrieving them stays out of scope.
- `buildContextBrief` remains synchronous, so a base is only used when passed explicitly.
  `root` resolves the ledger and hierarchy constraints (both synchronous).

## Migration Plan

Additive only. Existing callers pass the same arguments and receive the same text. The
hook passes `root`; tasks without a ledger keep the legacy brief.

## Open Questions

- None blocking. Feeding the projection into `assembly.js` is a follow-up change.
