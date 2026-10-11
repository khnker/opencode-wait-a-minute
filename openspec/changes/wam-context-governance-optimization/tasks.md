# WAM Context Governance Optimization — Tasks

## Tasks List

### [T-01] Create governance cache module
- Create `src/context/governance-cache.js`
- Implement `loadGovernanceSummary()`, `getCachedSummary()`, `invalidateCache()`
- Wire into pre-flight message handler (`src/integration/message-handler.js`)

### [T-02] Create historical case store
- Create `src/context/history-store.js`
- Implement `indexHistory()`, `findRelevantCase()`, `recordOutcome()`
- Scan git log (last 30 commits) and openspec archive for patterns

### [T-03] Trigram index warm-up manager
- Create `src/context/index-manager.js`
- Implement `ensureIndexFresh()`, `warmup()`
- Integrate with existing `tgrep` status flow

### [T-04] Add tests and benchmark cases
- Create `tests/unit/context/governance-cache.test.mjs`
- Create `tests/unit/context/history-store.test.mjs`
- Create `benchmarks/context/historical-cases.mjs` with 3 real-case patterns from git log
- Run full suite: `node scripts/run-tests.mjs` → 0 fail

### [T-05] Validate change
- `openspec validate wam-context-governance-optimization --strict`
- Ensure all acceptance criteria pass