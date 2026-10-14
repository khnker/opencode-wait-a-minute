# Frontend UX Evidence

## ADDED Requirements

### Requirement: Criterion-to-evidence association

The system MUST associate each frontend UX acceptance criterion with one or more verification methods: static analysis, automated tests, visual inspection, or human usability evaluation. Each association MUST be recorded in the evidence record.

#### Scenario: Criterion linked to evidence type
- **WHEN** a UX acceptance criterion is defined
- **THEN** it is linked to at least one verification method and the evidence record references the criterion

### Requirement: Evidence record completeness

For each UX claim, the evidence record MUST include: baseline behavior, intended change, observed result, evidence reference, and verification status. Unverified claims MUST be reported as unverified, not as achieved.

#### Scenario: Unverified claims reported as unverified
- **WHEN** a UX claim has no evidence of the required type
- **THEN** the verification status is reported as `unverified` and the claim is not marked as achieved

### Requirement: Verification sufficiency rules

The system MUST enforce that evidence type matches claim type: a passing unit test proves only its covered behavior; an a11y scanner result does not establish full a11y compliance; a screenshot supports visual claims but not task usability; a code diff does not prove interaction works; a usability improvement claim requires behavioral evaluation evidence.

#### Scenario: Screenshot does not establish usability
- **WHEN** a UX claim requires usability evaluation
- **THEN** a screenshot alone is insufficient and the claim remains `unverified`

### Requirement: Contradiction and supersession preservation

The system MUST preserve all evidence records, including contradictions and superseded evidence. No record is deleted; supersession is explicit.

#### Scenario: Contradictory evidence visible
- **WHEN** new evidence contradicts prior evidence for the same claim
- **THEN** both records are preserved and the contradiction is flagged in the verification status

### Requirement: Existing WAM contract preserved

The system MUST NOT change the existing outcome contract, DONE semantics, or evidence lifecycle for non-frontend UX tasks.

#### Scenario: Non-UX tasks unchanged
- **WHEN** a non-frontend UX task is verified
- **THEN** the existing outcome and evidence lifecycle are unchanged
