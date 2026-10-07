# Change: Approved Strategy Continuity

## ADDED Requirements
### Requirement: Strategy-Scoped Authorization
A user approval MUST authorize a strategy, not a single command. While the agent remains within the approved strategy, the declared scope, and the autonomy envelope, it MUST continue autonomously without re-requesting approval for ordinary execution steps.
#### Scenario: Validation step does not re-request approval
- **WHEN** the user has approved a strategy and the agent runs a validation step within that strategy and scope
- **THEN** the agent continues autonomously without asking for a new approval
### Requirement: Diagnosis Obligation on Failure
A failure within an approved strategy MUST generate a diagnosis obligation. Only contradictory evidence MUST invalidate the strategy; failure alone MUST NOT invalidate it.
#### Scenario: Failure triggers diagnosis, not re-approval
- **WHEN** an execution step within an approved strategy fails
- **THEN** the agent performs diagnosis rather than re-requesting strategy approval, unless contradictory evidence is found
### Requirement: Authorization Boundary
The persistent authorization boundary MUST be tied to strategy approval. Strategic changes, scope expansion, and blocked actions remain out of scope and MUST require new authorization.
#### Scenario: Strategic change requires new approval
- **WHEN** the agent attempts a strategic change or scope expansion
- **THEN** a new authorization is required