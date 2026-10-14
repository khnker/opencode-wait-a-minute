# Enforce Frontend UX Outcome Evidence — Design

## Goal

Ensure frontend UX completion claims are supported by evidence appropriate to the claim, leveraging existing WAM outcome contract and evidence lifecycle.

## Data Model

- Reuse `src/verification/outcome-evaluator.js`: `OutcomeEvaluator` class with `verifyOutcome(outcome)` that returns `{ valid, violations }`.
- Reuse `src/evidence/evidence.js`: `EvidenceRecord` class with `addEvidence(record)`, `getEvidence(claimId)`, `isVerified(claimId)`.
- Associate each UX acceptance criterion with verification methods:
  - `staticAnalysis`: automated code/static analysis evidence.
  - `automatedTest`: unit/integration test evidence.
  - `visualInspection`: screenshot or visual diff evidence.
  - `humanEvaluation`: usability test evidence.
- Evidence record fields: `id`, `type`, `source`, `timestamp`, `content`, `verified`.
- Verification status tracks `valid`, `invalid`, `pending` per claim.
- Preserves evidence contradictions and superseded records.

## Architecture & Flow

1. **Integration Hook**: During outcome verification (e.g., `approveContract`), run `outcomeEvaluator.verifyOutcome(outcome)` which triggers `evidence.isVerified(claimId)` for each UX acceptance criterion.
2. **Evidence Collection**: When evidence becomes available (via existing evidence lifecycle), record it and update verification status.
3. **Verification Rules**: 
   - Passing unit test only proves covered behavior, not the whole criterion.
   - a11y scanner does not establish full a11y compliance.
   - Screenshot supports visual claims but not task usability.
   - Code diff does not prove interaction works.
   - Usability improvement requires behavioral evaluation evidence.
   - Missing evidence never infers success.
4. **Outcome Blocking**: If `evidence.isVerified(claimId)` returns false or `outcomeEvaluator.verifyOutcome(outcome)` returns violations for a UX acceptance criterion, block completion.

## Integration Points

- `src/verification/outcome-evaluator.js`: add `verifyOutcome` for frontend UX acceptance criteria.
- `src/evidence/evidence.js`: use existing evidence for UX claims.
- Task execution: when UX work produces evidence, call `evidence.addEvidence(...)`.
- Outcome verification: trigger evidence verification alongside existing contract checks.

## Implementation Notes

- Do NOT modify existing outcome contract for non-UX tasks.
- Ensure UX evidence uses same evidence IDs as existing system.
- Preserve contradictions and superseded evidence for auditability.
- All verification rules are applied only when evidence type matches claim type.
EOF