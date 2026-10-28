# Design — Execution Ledger

## Context

Phase 1 normalized context, phase 3 modelled task hierarchy. Phase 4 needs structured
execution truth: requirements must be linked to actions, observations, evidence, decisions
and pending obligations, and that state must be derived from events rather than from a
free-form summary.

## Research

- W3C PROV-DM — entities, activities, agents and derivation:
  https://www.w3.org/TR/prov-dm/
- Event Sourcing (Martin Fowler) — state as a fold over an append-only event log:
  https://martinfowler.com/eaaDev/EventSourcing.html
- ISO/IEC/IEEE 29119 software testing / verification evidence:
  https://standards.ieee.org/ieee/29119/
- NASA software verification evidence guidance (independent verification and evidence
  traceability): https://www.nasa.gov/reference/software-engineering-handbook/

## Alternatives considered

### A. Regenerate execution state from the compaction brief text each turn

Rejected: the brief is prose, not evidence. Re-deriving `status` from text is
non-deterministic, cannot detect duplicate or missing events, and lets compaction rewrite
truth — exactly the failure mode the ledger exists to prevent. It also cannot prove that a
requirement was observed before it was verified.

### B. Reuse `replay-engine`'s full event log as the only store, with no per-task projection

Rejected: replaying the whole log for every task is unbounded and couples every read to the
global log shape. It provides no per-requirement conflict/obligation view, no idempotency
boundary per task, and no durable artifact that survives log rotation. A projection is still
needed, and computing it on every read is wasteful.

## Decision

Persist a small per-task ledger and fold only new events into it:

- `loadExecutionLedger` → missing file yields an empty ledger; corrupt JSON throws
  (fail loud on corrupt state).
- `applyEvents` → pure, returns a new ledger, skips already-processed ids (idempotent
  replay), counts unknown/malformed events in `ignoredEvents` instead of throwing.
- Status changes use `canTransition` / `VALID_TRANSITIONS` from
  `src/verification/verification-model.js`; the ledger never reimplements the table and
  rejects illegal jumps (e.g. `OPEN → VERIFIED`).
- `projectExecution` derives a sorted view; obligations come from non-VERIFIED
  requirements and open evidence conflicts, so they cannot be authored by hand.
- Writes use the existing temp-file + `renameSync` idiom from `task-state-file.js`.

**No compaction hook change in this phase.** Wiring the ledger into compaction/assembly is a
separate change with its own risk envelope; this phase only establishes the store and its
guarantees.

## Risks

- Events created by `createEvent` carry `timestamp` rather than `at`; the normalizer accepts
  both so existing producers remain compatible.
- A ledger whose task id disagrees with an event's task id skips that event (counted as
  ignored), which is intentional isolation between tasks.
