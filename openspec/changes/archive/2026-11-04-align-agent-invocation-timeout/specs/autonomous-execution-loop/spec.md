# Autonomous execution loop

## ADDED Requirements

### Requirement: Agent invocation timeouts match the orchestrator limit

The invocation adapter MUST use the same default deadline as the orchestrator
(`AGENT_RESOURCE_LIMITS.maxInvocationMs`) and MUST report an aborted prompt as
`PROMPT_TIMEOUT`, not `PROMPT_FAILED`. The persisted failure reason MUST include the
error code and the cause chain.

#### Scenario: A long-running builder pass is not cut short at two minutes

- **WHEN** an agent pass runs longer than 120 seconds but shorter than the configured
  orchestrator limit
- **THEN** the adapter does not abort the child session
- **AND** the pass result is returned normally

#### Scenario: An aborted prompt is reported as a timeout

- **WHEN** `client.session.prompt` rejects because the invocation signal aborted
- **THEN** the adapter throws an `AgentInvocationError` with code `PROMPT_TIMEOUT`
- **AND** the persisted `failureReason` contains the timeout message and the cause
