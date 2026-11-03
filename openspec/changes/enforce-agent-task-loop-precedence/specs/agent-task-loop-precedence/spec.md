# agent-task-loop-precedence

## ADDED Requirements

### Requirement: Hard agent stops outrank completion and budget

`decideNextAction` SHALL resolve agent hard stops before quality, `gateComplete`,
budget and iteration branches. A `FAILED` agent SHALL produce `BLOCK`
(`agent-failed`); `BLOCKED` and `NEEDS_INPUT` agents SHALL produce `WAIT_USER`
(`agent-blocked`/`agent-needs-input`); an exhausted revision or replan cycle
SHALL produce `WAIT_USER` (`agent-revision-exhausted`/`agent-replan-exhausted`),
even when the completion gate is satisfied or the budget/iteration limit is
exhausted.

#### Scenario: Failed agent with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent status is `FAILED`
- **THEN** the decision is `BLOCK` with reason `agent-failed`, not `COMPLETE`

#### Scenario: Blocked agent with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent status is `BLOCKED`
- **THEN** the decision is `WAIT_USER` with reason `agent-blocked`, not `COMPLETE`

#### Scenario: Needs-input agent with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent status is `NEEDS_INPUT`
- **THEN** the decision is `WAIT_USER` with reason `agent-needs-input`, not `COMPLETE`

#### Scenario: Exhausted review cycle with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent is exhausted with verdict `REVISION_REQUIRED`
- **THEN** the decision is `WAIT_USER` with reason `agent-revision-exhausted`, not `COMPLETE`

#### Scenario: Exhausted replan cycle with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent is exhausted with verdict `REPLAN_REQUIRED`
- **THEN** the decision is `WAIT_USER` with reason `agent-replan-exhausted`, not `COMPLETE`

#### Scenario: Hard stop with exhausted budget

- **WHEN** `budget.exhausted` is `true` and the agent status is `FAILED`
- **THEN** the decision is `BLOCK` with reason `agent-failed`

### Requirement: Reviewer rejection outranks evidence-complete

A non-exhausted reviewer rejection SHALL outrank a satisfied completion gate.
`REVISION_REQUIRED` SHALL produce `CONTINUE` (`agent-revision-required`) and
`REPLAN_REQUIRED` SHALL produce `REPLAN` (`agent-replan-required`) before the
gate-complete branch.

#### Scenario: Revision required with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent status is `REVISION_REQUIRED`
- **THEN** the decision is `CONTINUE` with reason `agent-revision-required`, not `COMPLETE`

#### Scenario: Replan required with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent status is `REPLAN_REQUIRED`
- **THEN** the decision is `REPLAN` with reason `agent-replan-required`, not `COMPLETE`

### Requirement: Completion gate remains authoritative for accepted reviews

An accepted agent review SHALL be evaluated after the completion gate so that a
satisfied gate still yields `COMPLETE`, while an unsatisfied gate yields `VERIFY`.

#### Scenario: Accepted review with satisfied gate

- **WHEN** `completionGate.ok` is `true` and the agent is `COMPLETED` with verdict `ACCEPTED`
- **THEN** the decision is `COMPLETE` with reason `evidence-complete`

#### Scenario: Accepted review with unsatisfied gate

- **WHEN** the completion gate has pending items and the agent is `COMPLETED` with verdict `ACCEPTED`
- **THEN** the decision is `VERIFY` with reason `agent-review-accepted`

#### Scenario: No agent with satisfied gate

- **WHEN** `completionGate.ok` is `true` and no agent outcome is supplied
- **THEN** the decision is `COMPLETE` with reason `evidence-complete`

### Requirement: Existing stop priority is preserved

Authorization, contract and task-blocked branches SHALL keep priority over the
agent precedence predicate, and existing decisions, reasons, `nextAction` and
checkpoint behavior SHALL remain unchanged for previously reachable cases.

#### Scenario: Denied authorization with failed agent

- **WHEN** `authorization.denied` is `true` and the agent status is `FAILED`
- **THEN** the decision is `BLOCK` with reason `authorization-denied`

#### Scenario: Pending authorization with failed agent

- **WHEN** `authorization.pendingAuth` is set and the agent status is `FAILED`
- **THEN** the decision is `WAIT_AUTHORIZATION` with reason `authorization-pending`

#### Scenario: Unapproved contract with failed agent

- **WHEN** `authorization.contractApproved` is `false` and the agent status is `FAILED`
- **THEN** the decision is `WAIT_USER` with reason `contract-not-approved`

#### Scenario: Task blocked with failed agent

- **WHEN** the task state is `BLOCKED` and the agent status is `FAILED`
- **THEN** the decision is `BLOCK` with reason `task-blocked`

#### Scenario: Accepted review with exhausted budget

- **WHEN** `budget.exhausted` is `true`, the gate is unsatisfied and the agent is `COMPLETED` with verdict `ACCEPTED`
- **THEN** the decision is `STOP_BUDGET` with reason `budget-exhausted`
