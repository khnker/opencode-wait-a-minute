# Enforce Outcome-Based Done

## Why

WAM's outcome evaluator (`src/verification/outcome-evaluator.js`) can classify outcomes into `ACHIEVED`, `PARTIAL`, `NOT_ACHIEVED`, and `UNVERIFIED`. However, the current implementation has several defects:

- Unverified observations are treated as satisfied criteria.
- Optional criteria are not distinguished from mandatory criteria in the final evaluation.
- Contradictory evidence is not resolved with temporal ordering.
- The contract validation is too permissive (e.g., loose string matching for evidence association).
- The evaluator is not integrated into the actual completion gate (`src/verification/completion-gate.js`), so `DONE` can still be claimed without passing through outcome evaluation.

This change closes the integration gap and fixes the evaluator defects so that WAM can guarantee that `DONE` requires verified outcome attainment.

## What Changes

- Fix outcome evaluator: strict contract validation, mandatory vs optional criteria separation, temporal evidence resolution, and verified observation requirements.
- Integrate outcome evaluation into the completion gate (`canComplete`).
- Add unit tests for all evaluator edge cases (optional criteria, temporal evidence, contradictory evidence, contract validation).
- Add integration tests verifying completion gate blocks `DONE` when outcome is unverified.
- Add E2E tests against the real WAM lifecycle.
- Extend the synthetic benchmark to cover optional criteria, temporal evidence, and contradictory evidence.
- Document the integration and acceptance criteria.

## Core Invariant

`DONE` MUST be blocked unless the outcome is evaluated as `ACHIEVED`, all mandatory criteria are verified with traceable evidence, and no blocking regressions exist.

## Non-Goals

- Replacing the existing completion gate or evidence engine.
- Requiring live LLM calls for deterministic tests.

## Expected Result

WAM's completion decisions are guaranteed to be backed by verified outcome attainment, and the system can prove this through integration, E2E, and benchmark tests.