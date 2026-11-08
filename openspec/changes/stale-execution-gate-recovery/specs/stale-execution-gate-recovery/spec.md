# Stale execution-gate recovery

## ADDED Requirements

### Requirement: Recover gates left by a previous process

When a mutating tool call is evaluated, WAM SHALL treat an active execution gate
whose `ownerPid` is not the current process as stale and clear it before
deciding whether to block. The decision SHALL be persisted so later calls see
`active=false`.

#### Scenario: Restart after a crash mid-pass

- **GIVEN** `task.json` contains `executionGate.active=true` with
  `ownerPid` from a process that no longer exists
- **WHEN** the main session calls a mutating tool
- **THEN** WAM clears the gate and allows the tool call

#### Scenario: Legacy gate without owner

- **GIVEN** `task.json` contains `executionGate.active=true` without `ownerPid`
- **WHEN** the main session calls a mutating tool
- **THEN** WAM clears the gate and allows the tool call

### Requirement: Keep blocking while the owning pass is in flight

WAM SHALL continue to block mutating tool calls while the gate is owned by the
current process.

#### Scenario: In-process agent pass

- **GIVEN** the current process wrote `executionGate.active=true` with its own
  `ownerPid`
- **WHEN** the main session calls a mutating tool
- **THEN** WAM blocks the call with the execution-gate directive
