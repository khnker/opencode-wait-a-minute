# Duplication Audit

Status: first pass complete (RC1 pre-work, change 1 of 5)
Date: 2026-10-05

## Method

1. Byte-identical file scan over `src/`, `tests/`, `benchmarks/`, `scripts/` (md5 grouping).
2. Duplicate exported-symbol scan over `src/`.
3. Manual semantic review of every symbol exported from 2+ modules.
4. Ownership decision per candidate against the architecture taxonomy (change 4).

## Objective Scan Results

- Byte-identical files: **none**. There is no D1 whole-file copy.
- `src/` production modules: 125.
- Tests: 166 `.mjs`; benchmarks: 74 `.mjs`; scripts: 16 files.
- Exported symbol names appearing in 2+ `src/` modules (top): `createEvidence` (4),
  `transition` (3), `recordDecision` (3), `canTransition` (3), `verifyRequirement` (2),
  `validatePolicyFlow` (2), `transitionVerification` (2), `retrieveContext` (2),
  `resolveConflict` (2), `recordObservation` (2), `normalizeContextItem` (2),
  `markStale` (2), `getUnresolvedRequirements` (2), `getResumeContext` (2),
  `getPreviousFailures` (2), `getPreviousDecisions` (2), `getNextPolicy` (2),
  `evaluateCompletionGate` (2), `estimateTokens` (2), `createObservation` (2),
  `createAssessment` (2), `canComplete` (2), `addObservation` (2), `addEvidence` (2),
  `addDecision` (2).

## Classification

- **D1 — exact duplicate**: none.
- **D2 — near duplicate with shared responsibility**: candidates below.
- **D3 — same name, overlapping semantics**: candidates below.
- **D4 — intentional structural duplication**: facades, per-domain variants.

## Findings

| Symbol | Locations | Class | Assessment | Ownership decision |
|---|---|---|---|---|
| `addObservation` / `addDecision` / `addEvidence` / `getExecutions` / `getUnresolvedRequirements` / `getPreviousFailures` | `src/task-runs.js`, `src/task-execution.js` | **D4** | `task-execution.js` are thin delegators to `task-runs.js` (compatibility facade, not logic copies). | Owner: **task**. Keep facade; no consolidation. |
| `evaluateCompletionGate` | `src/orchestration.js` (`state, promptText`), `src/verification-policy.js` (`task`) | **D2** | Two completion gates with different signatures; orchestration appears to re-implement verification policy. | Owner: **verification**. Orchestration should call the canonical gate. Consolidation pending characterization tests. |
| `createEvidence` | `src/evidence.js` (typed factory), `src/verification-lifecycle.js` (`method,result,details`) | **D3** | Two evidence constructors with different shapes (rich evidence model vs lifecycle record). | Owner: **verification**. Unify behind one factory or document distinct scopes. Pending. |
| `recordObservation` | `src/cognition-store.js` (persistent), `src/cognitive-state.js` (stub, `_`-prefixed args, no-op body) | **D2** | `cognitive-state.js` stub duplicates the name of the real persistent writer. | Owner: **task/cognition**. Resolve stub (delegate or remove). Pending. |
| `recordDecision` | `src/memory.js` (decision memory), `src/context-telemetry.js` (telemetry event) | **D4** | Same verb, unrelated domains (decision persistence vs context telemetry). | Distinct owners: **task** (memory) vs **context** (telemetry). Keep. |
| `canTransition` / `transition` / `transitionVerification` | `src/verification-model.js`, `src/execution-state.js`, verification modules | **D3** | State-machine transition helpers per domain. | Owner per domain (**verification**, **execution**). Document boundary; no merge unless semantics match. |
| `estimateTokens` | 2 context modules | **D3** | Token estimation may be reimplemented. | Owner: **context**. Consolidate to one estimator. Pending. |

## Consolidation Backlog (pending, behavior-preserving)

1. `evaluateCompletionGate` — make `orchestration.js` delegate to `verification-policy.js`; add characterization tests first.
2. `createEvidence` — unify `verification-lifecycle.js` onto `evidence.js` factory or document scopes.
3. `recordObservation` — resolve `cognitive-state.js` stub (delegate to `cognition-store.js` or remove).
4. `estimateTokens` — single canonical context estimator.

Each consolidation is gated on a characterization test that pins current behavior before the change.

## Unresolved

- Whether `orchestration.js#evaluateCompletionGate` semantics are a strict subset of `verification-policy.js` — needs a behavioral diff before consolidation.
- Whether `cognitive-state.js` is dead code or an intentional placeholder.

## Guard

- No byte-identical production files (D1 = 0) at audit time.
- Re-run the byte-identical scan and the duplicate-export scan after each consolidation to prevent regression.
