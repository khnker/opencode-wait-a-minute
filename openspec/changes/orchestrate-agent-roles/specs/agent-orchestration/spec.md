# Agent orchestration

## ADDED Requirements

### Requirement: Deterministic role sequence

WAM MUST run the initial agent pipeline in the fixed order
`ANALYST -> ARCHITECT -> BUILDER -> REVIEWER`, once per role, with no retries,
parallel branches or agent-to-agent calls.

#### Scenario: Successful pipeline

- **WHEN** every role returns `COMPLETED`
- **THEN** the adapter is invoked four times in sequence
- **AND** each invocation uses a unique role-scoped invocation ID

#### Scenario: Blocked role

- **WHEN** a role returns `BLOCKED`, `NEEDS_INPUT` or `FAILED`
- **THEN** the pipeline stops at that role
- **AND** no later role is invoked

### Requirement: Explicit handoffs

Each role request MUST be built from the task objective, acceptance criteria,
role-specific expected output and context selected from accumulated prior
results. Findings MUST become `priorFindings`; decisions and open questions MUST
become constraint lines; artifacts and evidence MUST be appended as refs.

#### Scenario: Analyst hands findings to Architect

- **WHEN** the Analyst returns findings
- **THEN** the Architect request contains those findings in `priorFindings`

#### Scenario: Architect hands decisions to Builder

- **WHEN** the Architect returns decisions
- **THEN** the Builder request contains each decision as a constraint line

#### Scenario: Builder hands evidence to Reviewer

- **WHEN** the Builder returns artifacts and evidence
- **THEN** the Reviewer request contains those refs

### Requirement: Review outcome boundary

A Reviewer `ACCEPTED` result MUST return `COMPLETED` with the accepted verdict.
`REVISION_REQUIRED` and `REPLAN_REQUIRED` MUST stop the pipeline without a
feedback cycle. Neither outcome MAY complete the task.

#### Scenario: Revision required

- **WHEN** the Reviewer returns `REVISION_REQUIRED`
- **THEN** the pipeline stops with that status
- **AND** no additional role is invoked

### Requirement: WAM owns state

The orchestrator MUST NOT persist or mutate task state, approvals, evidence or
completion. It MUST return the results, handoffs and context metadata for WAM to
store.

#### Scenario: State remains unchanged

- **WHEN** the orchestrator runs with a task state object
- **THEN** that object is unchanged

### Requirement: Strict orchestration input

Missing task ID, objective, acceptance criteria, adapter or context selector MUST
fail with `AgentOrchestrationError`.

#### Scenario: Missing adapter

- **WHEN** no adapter is provided
- **THEN** orchestration fails with `AgentOrchestrationError`
