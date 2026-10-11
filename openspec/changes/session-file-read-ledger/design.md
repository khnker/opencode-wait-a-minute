# Design: Session File Read Ledger

## Context
Data analysis shows over 50% of `read` calls are redundant re-reads, and `edit` operations frequently fail due to stale content (10.5% failure rate).

## Goals / Non-Goals
- **Goals**: Implement session-scoped file read ledger, detect/suppress redundant reads, guard `edit` operations against stale edits, ensure fallback on ledger error.
- **Non-Goals**: Persistent storage of the ledger across sessions, full refactoring of file handling.

## Decisions
- Ledger module `src/context/session-file-read-ledger.js` reusing `src/context/context.js` cache pattern.
- Ledger incorporates file digest for staleness detection.
- Redundant read suppression and `edit` guard integrated into `src/execution/runtime-guards.js` and `src/execution/execution-engine.js:120`.

## Risks / Trade-offs
- Risk: Potential for slight overhead in digest computation on every read. Mitigation: Minimal impact compared to redundant IO and potential failure recovery costs.

## Migration Plan
1. Implement ledger module.
2. Wire read/edit guards into existing execution flow.
3. Add unit tests for dedup, changed-file, stale-edit, error fallback.
