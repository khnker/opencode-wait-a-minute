# Enforce Frontend UX Outcome Evidence — Tasks

## Implementation
1. [x] Review `src/verification/outcome-evaluator.js` and `src/evidence/evidence.js` to understand reuse points.
2. [x] Define verification method taxonomy: staticAnalysis, automatedTest, visualInspection, humanEvaluation.
3. [x] Add UX criterion-to-evidence association to outcome evaluator.
4. [x] Record baseline, intended change, observed result, evidence reference, verification status.
5. [x] Implement verification rules (unit test = only covered behavior; a11y scanner ≠ full a11y; screenshot ≠ usability; diff ≠ interaction proof; usability improvement requires behavioral evaluation).
6. [x] Ensure missing evidence never infers success.
7. [x] Preserve contradictions/superseded evidence in evidence lifecycle.
8. [x] Tests: criterion without required evidence can't be verified; failed tests block dependent claims; partial completion accurate; contradictory evidence visible; frontend task completes per WAM contract; non-UX tasks unchanged; existing temporal/verification semantics unchanged.

## Verificación
9. [ ] Suite completa (npm test)
10. [x] `openspec validate --changes`
