# Agent role contracts

## ADDED Requirements

### Requirement: Closed role taxonomy

WAM MUST define exactly four initial roles: `ANALYST`, `ARCHITECT`, `BUILDER`
and `REVIEWER`. Verifier and Integrator MUST NOT be enabled in this change.
Each role MUST declare a responsibility and explicit limits.

#### Scenario: Unknown role

- **WHEN** a request or result declares role `VERIFIER`
- **THEN** validation fails with a role contract error

#### Scenario: Reviewer limits

- **WHEN** the Reviewer role is inspected
- **THEN** its limits state that it does not modify code, does not execute tests
  and does not approve completion

### Requirement: AgentRequest contract

Every invocation MUST provide `taskId`, `invocationId`, `role`, `objective`,
`acceptanceCriteria`, `input` and `expectedOutput`.
`input` MUST contain `artifacts`, `evidence`, `constraints` and `priorFindings`.
Acceptance criteria MUST use non-empty `id` and `description` fields and a
boolean `mandatory` field. Unknown top-level or input keys MUST be rejected.

#### Scenario: Missing invocation identity

- **WHEN** a request omits `invocationId`
- **THEN** validation reports a missing `invocationId` issue

#### Scenario: Context expansion attempt

- **WHEN** a request adds an undeclared `input.fullContext` field
- **THEN** validation reports it as not part of the contract

### Requirement: AgentResult contract

Every result MUST provide `taskId`, `invocationId`, `role`, `status`, `summary`,
`findings`, `decisions`, `artifacts`, `evidence`, `openQuestions`,
`recommendations` and `limitations`.
`status` MUST be one of `COMPLETED`, `BLOCKED`, `NEEDS_INPUT` or `FAILED`.
Unknown top-level keys MUST be rejected.

#### Scenario: Agent declares completion

- **WHEN** a result contains `status: "DONE"` or a `done` field
- **THEN** validation fails

#### Scenario: Incomplete result

- **WHEN** a result omits `summary` or `limitations`
- **THEN** validation fails and the result cannot be treated as satisfactory

### Requirement: Artifact and evidence references

Artifact and evidence references MUST be stable non-empty strings compatible
with the existing task model. A finding MUST NOT be interpreted as evidence.

#### Scenario: Invalid evidence reference

- **WHEN** a finding declares `evidence` as a string instead of an array
- **THEN** validation reports an array-type issue

### Requirement: Declarative capability matrix

WAM MUST declare these capabilities per role: `readContext`, `investigate`,
`proposeDecisions`, `modifyCode`, `modifyGlobalState` and `approveCompletion`.
Only Builder MAY declare `modifyCode`. Builder MUST NOT declare
`proposeDecisions`. No role MAY declare `modifyGlobalState` or
`approveCompletion`. The matrix MUST NOT be implemented as runtime enforcement
in this change.

#### Scenario: Capability inspection

- **WHEN** the capability matrix is read
- **THEN** every role has `modifyGlobalState: false` and
  `approveCompletion: false`

#### Scenario: No enforcement API

- **WHEN** the role-contract module is inspected
- **THEN** it exposes no permission assertion or input-guard function

### Requirement: Single coordinator and state ownership

WAM MUST remain the only coordinator. Agents MUST return results and MUST NOT
modify global task state, approve completion or invoke other agents. WAM owns
task state, approvals, evidence and completion.

#### Scenario: Agent result tries to complete the task

- **WHEN** an agent returns any status
- **THEN** no contract field can move the task to `DONE`

### Requirement: ReviewResult contract

A Reviewer result MUST include `review` unless the invocation status is `FAILED`.
`review.verdict` MUST be `ACCEPTED`, `REVISION_REQUIRED`, `REPLAN_REQUIRED` or
`BLOCKED`. Each review finding MUST include severity, description, at least one
evidence reference and a corrective action. `REVISION_REQUIRED` and
`REPLAN_REQUIRED` MUST include at least one finding. Non-Reviewer roles MUST NOT
return `review`.

#### Scenario: Revision without evidence

- **WHEN** the Reviewer returns `REVISION_REQUIRED` with a finding whose
  evidence array is empty
- **THEN** validation reports the missing evidence issue

#### Scenario: Accepted verdict

- **WHEN** the Reviewer returns `ACCEPTED` with status `COMPLETED`
- **THEN** validation accepts the result, but this does not mean tests ran, all
  criteria are verified or the task may complete

#### Scenario: Blocked verdict mismatch

- **WHEN** the Reviewer returns `BLOCKED` with status `COMPLETED`
- **THEN** validation reports an inconsistent status

### Requirement: Deterministic fail-loud validation

Contract validation MUST be deterministic and MUST fail loud. `assertAgentRequest`
and `assertAgentResult` MUST throw a `RoleContractError` containing every
detected issue. Validation MUST NOT coerce, repair or silently accept partial
output.

#### Scenario: Multiple violations

- **WHEN** a result has an unknown role, an invalid status and a missing field
- **THEN** the thrown error lists all detected issues

### Requirement: Provider-independent on-demand invocation

Contracts MUST NOT contain OpenCode session types, model names or host-specific
payloads. Roles MUST be invoked on demand by WAM and MUST NOT invoke each other.
This change MUST NOT add persistent per-role OpenCode agent configurations or
host-specific invocation code.

#### Scenario: Adapter independence

- **WHEN** a request or result is validated
- **THEN** validation depends only on WAM contract fields and no host adapter
