# Context Efficiency — Deterministic Validation Report

Generated from the deterministic workload matrix (`simulateWorkloadMatrix`) and the snapshot-state matrix (`runSnapshotStateValidation`). No network calls, no wall-clock in the data: re-running this suite reproduces the same tables and the same SVG bytes.

## Workload Composition

| Dimension | Value |
| --- | --- |
| Families | local, contextual, continuation, negative |
| Families exercised | local, contextual, continuation, negative |
| Scenarios | 8 |
| Turn coverage (observed) | [1, 3, 5, 10, 20] |
| Turn coverage (required) | [1, 3, 5, 10, 20] |

Family roles:

- `local` — single-turn, small scope. Baseline case for efficiency.
- `contextual` — project-level context that must be re-read when it changes.
- `continuation` — multi-turn sessions at 1/3/5/10/20 turns. This is where avoided
  rebuilds compound: the baseline pays a full reconstruction per turn, WAM pays once.
- `negative` — a control that MUST cost more. A negative reduction here is the
  expected, correct result and is reported unclamped.

## Derived Metrics (totals)

| Metric | Value |
| --- | --- |
| tokensPerRebuild | 4943.75 |
| tokensPerVerifiedTask | 4943.75 |
| rebuildReductionPct | 80.95 |
| inputReductionPct | 69.60 |
| totalReductionPct | 69.60 |

## Per-Scenario Causal Metrics

| Scenario | Family | Turns | Rebuilds | Fast path | Partial | Full | Total tokens | Baseline tokens | Reduction % |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| local-1 | local | 1 | 1 | 0 | 1 | 0 | 407 | 378 | -7.67 |
| contextual-1 | contextual | 1 | 1 | 0 | 1 | 0 | 703 | 1493 | 52.91 |
| continuation-1t | continuation | 1 | 1 | 0 | 0 | 1 | 3455 | 3275 | -5.50 |
| continuation-3t | continuation | 3 | 1 | 2 | 0 | 1 | 4601 | 9825 | 53.17 |
| continuation-5t | continuation | 5 | 1 | 4 | 0 | 1 | 5747 | 16375 | 64.90 |
| continuation-10t | continuation | 10 | 1 | 9 | 0 | 1 | 8628 | 32829 | 73.72 |
| continuation-20t | continuation | 20 | 1 | 19 | 0 | 1 | 14368 | 65659 | 78.12 |
| negative-1 | negative | 1 | 1 | 0 | 1 | 0 | 1641 | 267 | -514.61 |

Negative-control scenarios (local-1, continuation-1t, negative-1) report negative reduction by design. These are NOT clamped: a harness that hides them could not distinguish a real regression from a neutral run.

## Snapshot State Validation

| Classification | Cases |
| --- | ---: |
| VALID | 1 |
| STALE | 6 |
| INVALID | 3 |
| **total** | 10 |

Passed 10/10 cases (matrix declares 10). False-valid cases: none.

| Case | Mutates | Expected | Actual | Rebuild invoked | Pass |
| --- | --- | --- | --- | --- | --- |
| no-mutation | false | VALID | VALID | false | true |
| task-mutation | true | INVALID | INVALID | true | true |
| context-mutation | true | STALE | STALE | true | true |
| file-mutation | true | STALE | STALE | true | true |
| git-mutation | true | STALE | STALE | true | true |
| hash-mutation | true | INVALID | INVALID | true | true |
| stored-relevant-hash | true | STALE | STALE | true | true |
| snapshot-missing | true | STALE | STALE | true | true |
| snapshot-corrupt | true | STALE | STALE | true | true |
| snapshot-schema-incompatible | true | INVALID | INVALID | true | true |

## How to read this evidence

- **VALID** — snapshot still matches git, project context and task state. The turn runs on the fast path: no reconstruction at all, `rebuildInvoked` is false.
- **STALE** — something outside the task state changed (git revision, relevant files). Context is still usable, so a partial rebuild is enough.
- **INVALID** — the task state itself moved (phase/contract change) or the snapshot is malformed/incompatible. A full rebuild is mandatory; never a fast path.
- **Fast path vs partial vs full** — the three rebuild scopes are the mechanism behind the token deltas. `fastPathCount` is avoided work, `partialRebuildCount` is bounded rework, `fullRebuildCount` is the fallback the harness must never be able to dodge.
- **Negative control** — the `negative` family is expected to increase cost. Its negative savings value is the proof the measurement is sensitive in both directions.
- **Determinism** — the matrices contain no timestamps, RNG draws or network reads, so these numbers are reproducible on any machine and safe to diff in CI.

## Charts

- `charts/rebuild-vs-token.svg` — rebuild count vs total tokens, per scenario.
- `charts/savings-by-scenario.svg` — per-scenario reduction %, negatives included.
- `charts/continuation-scaling.svg` — turns 1/3/5/10/20, baseline vs WAM tokens.
- `charts/snapshot-state.svg` — VALID / STALE / INVALID counts.

Causal metric keys tracked: turns, contextRebuilds, fastPathCount, partialRebuildCount, fullRebuildCount, inputTokens, outputTokens, totalTokens, verification.
