# runtime-gates — delta

## ADDED Requirements
### Requirement: Explicit instructions do not enter ASKING
A prompt SHALL be treated as explicit when it starts with `[router]`, or when it
contains a file path and an actionable plan (≥2 list lines or ≥200 chars).
Explicit prompts SHALL NOT create the generic "add new functionality"
assumption and SHALL NOT enter `ASKING` on inferred assumptions.

#### Scenario: Router dispatch
- **WHEN** a dispatch starts with `[router]` and contains `add tests`
- **THEN** no blocking assumption is created
- **AND** `phase` is not `ASKING`

#### Scenario: Vague request keeps the gate
- **WHEN** the user writes `agregá algo` with no path or plan
- **THEN** the generic assumption is escalated and the task enters `ASKING`

### Requirement: Long specs synthesize real requirements
For prompts longer than 2000 chars flagged as specifications, the contract SHALL
be built from extracted deliverables (capped at `MAX_CONTRACT_REQUIREMENTS`)
before using the generic requirement.

#### Scenario: Spec with deliverables
- **WHEN** a long spec lists deliverables
- **THEN** the extracted deliverables become the requirements
- **AND** the count does not exceed `MAX_CONTRACT_REQUIREMENTS`

### Requirement: Security requirement uses bounded keywords
The security requirement SHALL match `auth`, `oauth`, `jwt`, `api_key`,
`secret` or `password` as whole words; the substring `token` SHALL not trigger it.

#### Scenario: Token metrics work
- **WHEN** a spec mentions token metrics
- **THEN** no "Auditar seguridad del cambio" requirement is added
