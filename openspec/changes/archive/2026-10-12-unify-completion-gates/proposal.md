# Unify Completion Gates

## Why
Two completion-gate implementations coexisted: the live `evaluateCompletionGate` in `src/integration/orchestration.js` (reached from the message handler) and a dead twin `canComplete` in `src/verification/completion-gate.js`. The twin's only production importer, `src/state/task-lifecycle.js`, is itself imported only by tests, so the twin was unreachable in production. This made the completion contract ambiguous and left a status-casing bug (`"verified"` vs `"VERIFIED"`).

## What Changes
- Delete `src/verification/completion-gate.js` and its now-orphan import/usages in `src/state/task-lifecycle.js`.
- Keep `evaluateCompletionGate` (`src/integration/orchestration.js`) as the single authoritative gate.
- Fix status casing in the outcome evaluator to accept `verified`/`VERIFIED`.
- Remove the dead-twin unit test and its load entry in `scripts/performance-sanity.mjs`.

## Core Invariant
Exactly one completion-gate implementation MUST exist, and it MUST be the one reached from the message handler.

## Non-Goals
- Change the gate's decision semantics.
- Introduce a new gate abstraction or configuration layer.

## Expected Result
A single authoritative gate, no dead code, and no casing ambiguity in outcome evaluation.
