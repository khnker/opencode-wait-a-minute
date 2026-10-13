## MODIFIED Requirements

### Requirement: Completion Gate Adversarial Cases
The completion gate MUST NOT grant completion on claim alone; missing evidence or required actions MUST yield NOT VERIFIED. The gate MUST evaluate every turn that is not an explicit continuation instruction, regardless of the wording of the completion claim.

#### Scenario: Claim without evidence is rejected
- **WHEN** the agent claims done with no evidence
- **THEN** the gate returns NOT VERIFIED

#### Scenario: Claim without action is rejected
- **WHEN** the agent claims done with a required action missing
- **THEN** the gate returns NOT VERIFIED

#### Scenario: Unlisted completion phrasing is still gated
- **WHEN** an approved task with an unverified requirement receives a completion claim phrased outside the DONE keyword list (e.g. "ya está", "ready", "todo ok")
- **THEN** the gate evaluates the checks and returns blocked instead of `{ blocked: false }`

#### Scenario: Evidence status is never upgraded
- **WHEN** a requirement is `done` without evidence, or is not `verified`
- **THEN** the gate blocks completion and reports the missing evidence as `sin evidencia`

## ADDED Requirements

### Requirement: No Approval Or Continuation Escape
The completion gate MUST NOT short-circuit on raw prompt substrings. Contract approval SHALL only occur through `/wam contract approve`; no prompt text ("aprobar contrato", "continuar") may bypass the completion checks or produce an `autoApprove` result.

#### Scenario: Raw approval phrase does not bypass
- **WHEN** the prompt contains "aprobar contrato" while the contract is not APPROVED
- **THEN** the gate returns blocked and no `autoApprove` field

#### Scenario: Continuation is not auto-approval
- **WHEN** the prompt is "continuar"
- **THEN** the gate returns `{ blocked: false }` without `autoApprove`, and contract status is unchanged
