# Agent task runtime

## ADDED Requirements

### Requirement: Opt-in agent configuration

The runtime MUST expose a nested `taskLoop.agents` configuration. Agent
invocations MUST be disabled by default. Configuration MUST be resolvable from
the project config file and environment variables, and MUST accept zero revision
or replan cycles.

#### Scenario: Default disabled

- **WHEN** no agent configuration is present
- **THEN** `taskLoop.agents.enabled` is `false`
- **AND** the runtime does not invoke agents

#### Scenario: File enables agents

- **WHEN** the project config sets `taskLoop.agents.enabled` to `true`
- **THEN** the resolved configuration enables agent invocations

#### Scenario: Environment overrides the file

- **WHEN** the file enables agents and the environment disables them
- **THEN** the resolved configuration disables agent invocations

#### Scenario: Zero revision cycles

- **WHEN** the configuration sets `maxRevisionCycles` to `0`
- **THEN** the resolved value is `0`

### Requirement: Deterministic freshness guard

The runtime MUST skip agent invocations for terminal results and MUST run when
no terminal result exists. The guard MUST NOT use wall-clock time.

#### Scenario: No prior run

- **WHEN** the task has no `agentRun`
- **THEN** the guard allows an agent invocation

#### Scenario: Accepted completion

- **WHEN** `agentRun` is `COMPLETED` with an `ACCEPTED` verdict
- **THEN** the guard skips the agent invocation

#### Scenario: Exhausted feedback

- **WHEN** `agentRun.exhausted` is `true`
- **THEN** the guard skips the agent invocation

#### Scenario: Blocked or failed result

- **WHEN** `agentRun.status` is `BLOCKED`, `NEEDS_INPUT` or `FAILED`
- **THEN** the guard skips the agent invocation

#### Scenario: Pending result

- **WHEN** `agentRun` is `COMPLETED` with `REVISION_REQUIRED` and not exhausted
- **THEN** the guard allows an agent invocation

### Requirement: WAM-owned persistence

The runtime MUST persist the updated task and its bounded agent summary through
`persistTaskState`. Agents MUST NOT write global state, approve completion or
create a `DONE` status.

#### Scenario: Agent run persisted

- **WHEN** an agent pass produces an outcome
- **THEN** the updated task, including `agentRun` and capped `agentHistory`, is
  passed to `persistTaskState`
- **AND** the outcome is returned to the caller

#### Scenario: Disabled runtime

- **WHEN** agent invocations are disabled
- **THEN** the configured runner returns `null`
- **AND** it does not call the adapter or persistence callback

### Requirement: Runtime handoff

The runtime MUST run the agent pass before `driveTaskLoop` and MUST pass the
outcome to `driveTaskLoop`. The Task Loop MUST retain decision authority, and
budget or iteration guards MUST take precedence over the agent outcome.

#### Scenario: Accepted review handed off

- **WHEN** the agent outcome is completed with an accepted verdict
- **THEN** `driveTaskLoop` receives the outcome
- **AND** the resulting decision is `VERIFY`

#### Scenario: Budget exhausted

- **WHEN** the loop budget is exhausted and an accepted agent outcome exists
- **THEN** the resulting decision is `STOP_BUDGET`

#### Scenario: Agent failure

- **WHEN** the agent pass throws
- **THEN** the runtime logs the failure
- **AND** `driveTaskLoop` still runs without an agent outcome

### Requirement: Single in-flight agent pass

The runtime MUST prevent concurrent agent passes for the same task inside one
plugin process.

#### Scenario: Duplicate idle events

- **WHEN** a second idle event arrives while an agent pass is running for the
  same task
- **THEN** the second event does not start another agent pass
