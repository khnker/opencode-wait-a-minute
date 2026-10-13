# unify-completion-gates Specification

## Purpose
TBD - created by archiving change unify-completion-gates. Update Purpose after archive.
## Requirements
### Requirement: Single Authoritative Completion Gate
- Exactly one completion-gate implementation MUST exist.
- The gate reached from the message handler (`evaluateCompletionGate` in `src/integration/orchestration.js`) MUST be authoritative.
- Duplicate/dead gate implementations MUST be removed.

#### Scenario: Dead twin removed
Given the repository
When completion-gate implementations are enumerated
Then only `evaluateCompletionGate` remains
And `src/verification/completion-gate.js` does not exist

### Requirement: Status Casing Normalization
- The outcome evaluator MUST treat evidence/observation status case-insensitively for `VERIFIED`.

#### Scenario: lowercase verified evidence satisfies a criterion
Given evidence with `status: "verified"`
When the outcome is evaluated
Then the criterion MUST be SATISFIED

