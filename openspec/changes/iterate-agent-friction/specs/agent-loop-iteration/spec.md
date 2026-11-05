# Agent loop iteration

## ADDED Requirements

### Requirement: Retryable invocation failures iterate

WAM MUST retry retryable agent-invocation failures inside the agent pass,
bounded by `taskLoop.agents.maxAttempts`, and MUST feed the previous failure
and a narrower context to the next attempt.

#### Scenario: Timeout then success

- **WHEN** an invocation fails with `PROMPT_TIMEOUT` or an aborted child session
  and the retry budget is not exhausted
- **THEN** WAM runs the orchestration again with the previous failure as a
  constraint and a reduced context budget
- **AND** a successful retry returns the orchestration outcome and the number
  of attempts used

#### Scenario: Retry budget exhausted

- **WHEN** every allowed attempt fails with a retryable error
- **THEN** WAM persists `agentRun.status = "FAILED"` with `failureCode` and
  `attempts`
- **AND** the task loop surfaces `WAIT_USER` with an actionable
  `agent-failed: <reason>`

### Requirement: Terminal agent failure is actionable

WAM MUST NOT map a terminal agent failure to `BLOCK`; `BLOCK` is reserved for
denied authorization and task-blocked states.

#### Scenario: Failed agent run

- **WHEN** the agent run status is `FAILED`
- **THEN** the loop decision is `WAIT_USER`
- **AND** the reason names the failure

#### Scenario: Task blocked

- **WHEN** the task state is `BLOCKED`
- **THEN** the loop decision remains `BLOCK`

### Requirement: Analysis friction drives another round

In ANALYZE mode WAM MUST act on reviewer rejections by rerunning the relevant
roles with the review findings as constraints, bounded by the configured
revision and replan cycles.

#### Scenario: Revision accepted

- **WHEN** the Reviewer returns `REVISION_REQUIRED` and a revision cycle remains
- **THEN** ANALYST and ARCHITECT run again with the review findings as
  constraints
- **AND** the Reviewer runs again with the new evidence
- **AND** an accepted result returns `COMPLETED`

#### Scenario: Replan accepted

- **WHEN** the Reviewer returns `REPLAN_REQUIRED` and a replan cycle remains
- **THEN** ARCHITECT runs again with the review findings as constraints
- **AND** the Reviewer runs again
- **AND** an accepted result returns `COMPLETED`

#### Scenario: Analysis friction exhausted

- **WHEN** the Reviewer keeps rejecting after the configured cycles
- **THEN** the pipeline stops with the reviewer verdict
- **AND** the result is marked `exhausted: true`
- **AND** the original review findings remain in the handoff
