# Proposal: Session File Read Ledger

## Why
Analysis shows 54.6% of `read` tool calls are redundant re-reads of the same file in a single session, and 10.5% of `edit` calls fail due to stale/non-matching content buffers. WAM needs a session-scoped file read ledger to prevent redundant reads and guard against stale edits.

## What Changes
- Add a session-scoped ledger module `src/context/session-file-read-ledger.js` leveraging `src/context/context.js`.
- Annotate or suppress redundant reads in `src/execution/runtime-guards.js`.
- Guard `edit` operations against stale buffers via `src/execution/execution-engine.js:120`.

## Capabilities
### New Capabilities
- `session-file-read-ledger`: session-scoped file read ledger that deduplicates reads and guards edits against stale content.

## Impact
- Drastically reduces context bloat caused by duplicate `read` calls.
- Reduces `edit` errors caused by out-of-sync/stale file contents.
- Improves overall performance and cost efficiency.
