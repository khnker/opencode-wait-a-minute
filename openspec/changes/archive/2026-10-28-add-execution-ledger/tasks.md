# Tasks — Execution Ledger

## 1. Store

- [x] 1.1 Add `src/state/execution-ledger.js` with versioned ledger shape and atomic save.
- [x] 1.2 Implement `loadExecutionLedger`: missing → empty, corrupt → throw.
- [x] 1.3 Implement pure `applyEvents` with idempotent replay and ignored-event counting.
- [x] 1.4 Map real `WAM_EVENTS` types to requirements, actions, observations, evidence,
      decisions and obligations.
- [x] 1.5 Reuse `VALID_TRANSITIONS` / `canTransition`; reject illegal status jumps.
- [x] 1.6 Implement `projectExecution` with sorted requirements, obligations and conflicts.

## 2. Tests

- [x] 2.1 Full claim→action→observation→evidence→verification replay yields VERIFIED.
- [x] 2.2 Duplicate ids do not double-append; unknown/malformed events are ignored.
- [x] 2.3 Skipping the chain cannot reach VERIFIED.
- [x] 2.4 Evidence conflict appears in the projection and blocks completion.
- [x] 2.5 Obligations list only non-verified requirements.
- [x] 2.6 No input mutation; persistence round-trip; corrupt file throws; legacy task empty.

## 3. Validation

- [x] 3.1 `node --test --test-force-exit src/state/execution-ledger.test.mjs`
- [x] 3.2 `openspec validate --changes --strict`
- [x] 3.3 `npm run build`

## 4. Out of scope

- [ ] 4.1 Wiring into `context-compaction.js`, the compaction hook, `assembly.js`,
      `context.js` or the router (separate change).
