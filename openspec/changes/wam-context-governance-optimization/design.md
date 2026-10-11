# Design: WAM Context Governance Optimization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WAM Pre-flight Analysis                  │
├─────────────────────────────────────────────────────────────┤
│  1. Context Cache Layer (in-memory + persisted)            │
│     - GovernanceSummary: distilled AGENTS.md (≤200 tokens)  │
│     - HistoricalCases: { pattern → { changeId, outcome } } │
│     - IndexStatus: tgrep freshness + coverage               │
│                                                             │
│  2. Selection Engine Enhancements                           │
│     - retrieveWithHistory(query) → { context, cases }       │
│     - warmupTrigramIndex() → Promise<void>                  │
│     - compressContext(sections) → compressedSummary         │
│                                                             │
│  3. Runtime Guards Integration                              │
│     - LoopBudgetGuard: tracks token burn rate               │
│     - SessionFileReadLedger: prevents duplicate reads       │
│     - AuditCoalescer: batches governance decisions          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Context Cache (src/context/governance-cache.js)
- `loadGovernanceSummary()`: reads AGENTS.md once, extracts actionable rules
- `getCachedSummary()`: returns memoized summary with TTL
- `invalidateCache()`: on file change detection

### Phase 2: Historical Case Store (src/context/history-store.js)
- `indexHistory()`: scans git log + openspec archive for patterns
- `findRelevantCase(pattern)`: fuzzy match on task description
- `recordOutcome(changeId, tokens, tests, duration)`: persist metrics

### Phase 3: Trigram Index Manager (src/context/index-manager.js)
- `ensureIndexFresh()`: runs `tgrep status` + `tgrep index` if stale
- `warmup()`: primes index in background during pre-flight

### Phase 4: Integration Points
- `src/integration/message-handler.js`: call cache warmup on init
- `src/execution/runtime-guards.js`: hook compression trigger
- `src/context/selection.js`: expose `retrieveWithHistory`

## Test Strategy
- Unit: each cache/store manager function
- Integration: pre-flight → cache → selection flow
- Benchmark: historical cases from git log (last 50 commits)