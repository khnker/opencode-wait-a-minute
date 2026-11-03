# Agent session governance

## ADDED Requirements

### Requirement: Worker sessions resolve their parent

WAM MUST read the session parent from the `client.session.get` response,
including when the SDK wraps the payload in `data`. A session with a non-null
`parentID` MUST be treated as a worker session and MUST NOT enter the task
auto-loop.

#### Scenario: Wrapped session response

- **WHEN** `client.session.get` returns `{ data: { parentID, directory } }`
- **THEN** WAM caches that parent and uses the returned directory
- **AND** the worker session's task loop is skipped

#### Scenario: Worker prompt injection

- **WHEN** a prompt arrives in a session whose resolved parent is non-null
- **THEN** WAM emits no task context, delegation directive or system injection
  for that prompt
