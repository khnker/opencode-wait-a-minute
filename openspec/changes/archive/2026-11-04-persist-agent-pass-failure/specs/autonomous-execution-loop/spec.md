# Autonomous execution loop

## ADDED Requirements

### Requirement: A failed agent pass is persisted and stops automatic retries

When an agent pass throws, the host MUST persist a terminal `FAILED` run with the
failure reason instead of only logging the error. It MUST stop scheduling automatic
passes for that task until a real user turn reopens the run, and the existing
terminal-pause surfacing MUST report the reason once.

#### Scenario: Adapter error fails the pass

- **WHEN** `runTaskAgentPass` throws before returning an outcome
- **THEN** the task's `agentRun.status` is `FAILED`
- **AND** `agentRun.failureReason` contains the error message
- **AND** `shouldRunTaskAgentPass` returns false on the next idle
- **AND** the loop decision is `BLOCK` with reason `agent-failed: <detail>`
- **AND** the host surfaces that reason once

#### Scenario: A real user turn reopens the failed run

- **WHEN** a real user message arrives after a persisted `FAILED` run
- **THEN** `reopenTerminalAgentRun` clears `status`, `verdict`, `surfaced` and
  `exhausted`
- **AND** the next idle can schedule a fresh pass
