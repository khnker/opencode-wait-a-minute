# Tasks

## 1. Implement and Wire Read Ledger

- [x] 1.1 Create `src/context/session-file-read-ledger.js` (standalone digest ledger via `node:crypto`; fail-open).
- [x] 1.2 Implement read annotation/suppression in `src/execution/runtime-guards.js`.
- [x] 1.3 Wire `edit` guard (via `guardAction` in runtime-guards, invoked from `execution-engine.js:128`).
- [x] 1.4 Implement `src/context/session-file-read-ledger.test.mjs` (dedup, changed-file, stale-edit, error fallback). Run with `node --test src/context/session-file-read-ledger.test.mjs`.
