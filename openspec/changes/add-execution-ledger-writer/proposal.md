## Why

The semantic projection (`src/context/semantic-projection.js`) only runs when a
per-task execution ledger exists. No production code path writes that ledger:
`saveExecutionLedger`/`applyEvents` are used only by tests, so
`resolveProjection` always returns `null` and shadow telemetry records
`fallbackReason: "no-ledger-and-no-base"`. The projection is therefore
unreachable in real sessions and the shadow gate can never collect a record
with `projectionAvailable: true`.

## What Changes

- Add `src/state/ledger-writer.js`, the production seam that turns task-state
  transitions into ledger events (`CLAIM_CREATED` on contract approval,
  `ACTION_STARTED`/`OBSERVATION_CREATED`/`EVIDENCE_ADDED`/`VERIFICATION_COMPLETED`
  on requirement progress).
- Seed the ledger from the contract requirements when the contract is approved.
- Record requirement status changes in `markRequirement` (`done`, `verified`,
  `pending`).
- Drop the stale ledger when the contract is edited (requirement ids are
  rebuilt).
- Writer failures are logged and never abort the user-visible state change.

## Impact

- Affected specs: `execution-ledger` (new requirement: production ledger writer).
- Affected code: `src/state/ledger-writer.js` (new), `index.js` (approval,
  `markRequirement`, `editContract`), tests.
- No new dependencies, no format change to `execution-ledger.json`.
