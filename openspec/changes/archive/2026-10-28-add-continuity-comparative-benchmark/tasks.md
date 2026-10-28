## 1. Benchmark

- [x] 1.1 Build one rich fixture with project→group→task chain, contract,
      verified + pending requirements, evidence conflict, decisions, canonical
      base (active + invalidated) and a sibling task with a secret.
- [x] 1.2 Implement `full`, `top-k` and `wam` strategies under the same
      4000-character budget, all derived from the same state.
- [x] 1.3 Define the ten continuity probes and score every strategy.
- [x] 1.4 Report `continuity`, `mandatoryLost`, `briefTokens`, `recoveryTokens`,
      `totalTokens` and informational `selectMs`.
- [x] 1.5 Assert WAM 10/10, mandatoryLost 0, strict superset on status-aware
      probes, and at least one deliberate failure per naive strategy.
- [x] 1.6 Assert restart determinism and the shared budget.
- [x] 1.7 Print the compact metrics table.
- [x] 1.8 Add a large-state fixture (60 requirements, 40 decisions, 40
      canonical entries) and assert `full` truncates and loses the pending
      requirement plus a status-aware probe while `wam` keeps 10/10 within
      budget and stays restart-deterministic.

## 2. Wiring

- [x] 2.1 Add the `bench:continuity-comparison` npm script.

## 3. Verification

- [x] 3.1 `node --test --test-force-exit benchmarks/continuity-comparison.test.mjs`
- [x] 3.2 `npm run bench:continuity-comparison`
- [x] 3.3 `node --test --test-force-exit benchmarks/semantic-continuity.test.mjs`
- [x] 3.4 `openspec validate --changes --strict`
