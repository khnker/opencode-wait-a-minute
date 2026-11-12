# Write Tool Autonomy Capability

## ADDED Requirements

### Requirement: Workflow state never blocks write tools

WAM MUST NOT abort `write`, `edit`, `patch`, `bash`, `sh`, `task` or `todowrite` calls
because of WAM workflow state (contract approval, permission preflight, execution gate or
inferred uncertainty). The calls proceed with the normal opencode tools.

#### Scenario: Contract is not approved

- **GIVEN** a task whose contract status is `PROPOSED` or `DRAFT`
- **WHEN** the agent calls `edit` or `bash`
- **THEN** WAM does not throw and the tool call proceeds
- **AND** any contract notice is a recommendation, never a block

#### Scenario: Analysis loop is active

- **GIVEN** an active execution gate
- **WHEN** the agent calls `write` or `edit`
- **THEN** WAM does not abort the call

#### Scenario: Permission plan is pending

- **GIVEN** a permission preflight plan that is not granted
- **WHEN** the agent calls a mutating tool
- **THEN** WAM does not throw and the tool call proceeds

#### Scenario: Path outside the project root

- **GIVEN** a write target outside the task root
- **WHEN** the host allows the call
- **THEN** WAM does not reject it; the host permission layer owns the boundary

### Requirement: Only explicit technical blockers park execution

WAM MUST record inferred uncertainties as `advisory`. WAM MUST park a task in `ASKING`
only for an unknown that explicitly carries `blocking: true` and has no recorded
decision. A persisted `ASKING` task with no explicit blocker MUST be normalized to
`IMPLEMENTING` on the next turn.

#### Scenario: Inferred deletion uncertainty

- **GIVEN** a prompt that mentions "elimina" and the analyzer infers a deletion-scope
  uncertainty
- **WHEN** the message handler evaluates blocking questions
- **THEN** the task is not parked in `ASKING`
- **AND** the agent continues with the normal tools

#### Scenario: Explicit technical blocker

- **GIVEN** an unknown marked `blocking: true`
- **WHEN** no decision is recorded for it
- **THEN** the task enters `ASKING` and the question is presented

### Requirement: Safety invariants remain

WAM MUST keep blocking irreversible or destructive operations (hard delete, U1
soft-archive violations) and corrupt-state validation.

#### Scenario: Hard delete command

- **GIVEN** a `bash` call matching a hard-delete pattern
- **WHEN** the execution guard runs
- **THEN** the decision is `allowed: false` with a hard-delete reason
