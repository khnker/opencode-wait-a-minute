## Context

`execution-ledger.js` is a pure event-sourced store: `applyEvents` only mutates
through typed events and `projectExecution` derives status, obligations and
conflicts. Compaction calls `buildContextBrief`, which loads the ledger from
`.wam/tasks/<id>/execution-ledger.json` and degrades to the legacy brief when it
is missing or empty.

Today that file is never written outside tests, so the projection and the shadow
gate only ever see fallbacks.

## Goals / Non-Goals

**Goals**
- Make the projection reachable in production with the smallest seam.
- Keep the ledger event-sourced and idempotent: no free-text summaries.
- Never let telemetry break a user-visible state transition.

**Non-Goals**
- Emitting events from prose parsing or LLM output.
- Replacing `task.json` as the current-state source of truth.
- Writing the canonical base (`canonical/base.json`).

## Research

- Event sourcing reference (append-only events as source of derived state):
  https://martinfowler.com/eaaDev/EventSourcing.html
- Node.js atomic replace used by `saveExecutionLedger` (`writeFileSync` + `renameSync`):
  https://nodejs.org/api/fs.html#fsrenamesyncoldpath-newpath
- Existing transition table already validated by the ledger tests:
  `src/verification/verification-model.js` (`VALID_TRANSITIONS`).

## Alternatives Considered

1. **Derive the ledger at compaction time from `task.json`** (rejected):
   cheapest to write, but it bypasses the event model, cannot represent
   conflicts/obligations, and re-derives evidence on every compaction with no
   stable event ids, so replay and idempotency guarantees are lost.
2. **Hook `saveTask`/`persistTaskState` and diff every write** (rejected):
   covers all paths implicitly, but puts ledger I/O in the hottest state path,
   makes every task write depend on ledger correctness, and produces diff events
   instead of meaningful domain events.
3. **Writer at the explicit transition points (chosen)**: approval seeds
   `CLAIM_CREATED`; `markRequirement` emits the legal chain up to the target
   status through `applyEvents`. Two call sites, deterministic legality enforced
   by `VALID_TRANSITIONS`, failures isolated with `try/catch` + log.

## Decisions

- `recordRequirementStatus(root, taskId, {requirementId, status, evidence})`
  advances the ledger step by step (`OPEN → IN_PROGRESS → OBSERVED → SUPPORTED →
  VERIFIED`) and stops when a transition is illegal, so a ledger that is behind
  the task state catches up without inventing states.
- Lazy seeding: an unknown `requirementId` is created with `CLAIM_CREATED` so
  tasks created before this change still get a ledger on first progress mark.
- `pending` from `VERIFIED` uses `VERIFICATION_COMPLETED` with `status: "OPEN"`,
  the only legal backward transition.
- Contract edit deletes the ledger instead of rewriting it: requirement ids are
  rebuilt and old events no longer describe the contract.

## Risks / Trade-offs

- Ledger writes add one small file read/write per `markRequirement` call; the
  calls are user-driven, not per-token.
- Evidence text is clipped to 180 chars in the ledger; the full evidence stays
  in `task.json`.
