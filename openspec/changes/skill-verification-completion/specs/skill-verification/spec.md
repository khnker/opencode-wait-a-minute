# Skill Verification
## ADDED Requirements
### Requirement: Completion requires verified evidence
A completion claim (DONE/COMPLETED/FIXED/VERIFIED) MUST NOT be emitted unless the claim
reached state VERIFIED through a verification action and evidence.
#### Scenario: Reason-only completion
- **WHEN** the agent claims completion from reasoning alone
- **THEN** the claim is UNKNOWN and the completion token is blocked
#### Scenario: Verified with evidence
- **WHEN** a verification action produced evidence satisfying the method
- **THEN** the claim is VERIFIED and the token is allowed

### Requirement: Explicit verification method
Every completion claim MUST declare exactly one `verification_method` among
`automated`, `observational`, `external_evidence`, `human_confirmation`.
#### Scenario: Missing method
- **WHEN** a completion claim declares no method
- **THEN** it is downgraded to UNKNOWN
#### Scenario: Observational method
- **WHEN** the method is `observational` and a captured observation exists
- **THEN** the claim may reach VERIFIED

### Requirement: Claim state model
The system MUST distinguish CLAIMED, SUPPORTED, VERIFIED, FAILED and UNKNOWN.
#### Scenario: Failed verification
- **WHEN** the verification action contradicts the claim
- **THEN** the state is FAILED
