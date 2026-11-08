# Skill Verification Delta

## ADDED Requirements

### Requirement: Code changes pass a Craftsman review before completion
A completion claim for a task that changed code MUST include a review of the
diff against the `craftsman` skill's Diff Audit (KISS, DRY, clean code), and the
claim MUST NOT be emitted while that review has unresolved violations.

#### Scenario: Tests pass but the diff is not reviewed
- **WHEN** a code change passes its tests and the diff has not been audited against the Craftsman Diff Audit
- **THEN** the completion gate MUST block DONE and report the missing review

#### Scenario: Diff reviewed with an accepted exception
- **WHEN** the diff was audited and a violation is recorded as an accepted exception
- **THEN** the review is satisfied and the existing completion gate decides the rest

#### Scenario: No code changed
- **WHEN** the task changed only documentation or configuration and no code
- **THEN** the Craftsman review is not required
