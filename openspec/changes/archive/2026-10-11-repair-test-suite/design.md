## Context

`scripts/run-tests.mjs` discovers 227 `*.test.mjs` suites and runs them in a single `node --test --test-concurrency=1` invocation with a global timeout of `WAM_TEST_TIMEOUT_MS` (default 120000). A per-file matrix (20s cap) showed: 202 pass, 23 exit 1, 2 exit 124 (hang).

## Diagnosis

Grouped by likely shared root cause:

- **Cluster A — context engine (10):** `context-assembly` (N2 obligatorio), `context-classification` (OBSERVATION≠DECISION), `context-manager` (getSource), `context-evaluation`, `context.test` (selector sufficiency), `refactor-context-engine` (N2 presente), `router-adapter`, `router-sufficiency-integrity` (`undefined.values`), `runtime-context-graph` (reference equality), `test/ingestion-cap` (N2 line). The context engine was recently built (`421f9ed`, `c4ca5ee`), so these are most likely contract drift between the new architecture and the tests, or a real regression in N2 assembly / classification / routing.
- **Cluster B — execution/verification (8):** `execution-assessment`, `execution-loop-e2e` (`undefined.id`), `task-execution-consolidation` (executions in state.yaml), `test/full-runtime-e2e` (gate blocks when verified), `test/hypothesis-evaluation-e2e`, `test/runtime-execution-e2e`, `verification-persistence` (all persist/load), `verification-service-e2e`.
- **Cluster C — release/misc (5):** `release-manager`, `strategy-capabilities`, `state-machine` (re-export), `test-gaps-v11`, `autonomous-task-runner` (EACCES renaming `.wam/...`).
- **Hangs (2):** `runtime-guard.test.mjs`, `scripts/wam-audit.test.mjs`.

## Approach

1. Fix one cluster at a time, highest leverage first (A → B → C → hangs).
2. For each failing suite, decide whether the defect is in source or in the test expectation. Prefer the smallest correct change.
3. Never make a test pass by skipping/weakening it unless the expectation is provably obsolete after the context-engine build; record the rationale.
4. Verify each file exits 0 in isolation, then run the full suite and confirm it terminates under the timeout.
5. Only after the suite is green does the gate's `Test Suite` stage stay required.

## Risks

- Cluster A may be a single root cause (high leverage) or several; do not assume.
- The `autonomous-task-runner` EACCES may be environmental (leftover `.wam` perms); fix the test's isolation if so.
- The hangs may be open handles (timers, child processes); ensure the runner can terminate.
