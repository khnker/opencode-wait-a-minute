# autonomous-execution-loop Specification Delta

## ADDED Requirements

### Requirement: Loop prompts are provenance-tagged

`buildTaskLoopPrompt()` MUST mark every part it returns with the WAM
provenance marker (`metadata.wam === true`), in addition to
`synthetic: true`, so the `chat.message` hook can distinguish a loop
continuation from genuine user input.

#### Scenario: Synthetic loop prompt is ignored by the chat hook

- **GIVEN** a task loop decides `WAIT_USER` and `driveTaskLoop` sends the
  prompt returned by `buildTaskLoopPrompt()`
- **WHEN** the `chat.message` hook runs for that persisted prompt
- **THEN** `extractPrompt()` returns an empty string
- **AND** the handler returns before `reopenTerminalAgentRun()`
- **AND** the task's `agentRun.surfaced` marker is not reset

#### Scenario: Real user message still reopens a terminal run

- **GIVEN** a task whose `agentRun.status` is `FAILED` and `surfaced` is true
- **WHEN** the user sends a message without the WAM provenance marker
- **THEN** `reopenTerminalAgentRun()` clears the terminal status and
  `surfaced`
- **AND** the next agent pass is allowed

### Requirement: Terminal surface is idempotent across agent passes

The runtime MUST surface a terminal agent signal (`exhausted === true` or
status `BLOCKED`, `NEEDS_INPUT`, `FAILED`) to the user at most once per identical
signal, even when subsequent agent passes fail with the same signal.
`applyAgentRun()` and `agentSignalForLoop()` MUST carry the previous
`surfaced` marker forward when `status`, `verdict`, `exhausted` and
`failureCode` are unchanged. `driveTaskLoop()` MUST also consult its persisted
`lastDecision` and refuse to re-surface a repeated non-authorization decision.

#### Scenario: Repeated identical failure does not re-prompt

- **GIVEN** a task with `agentRun = { status: "FAILED", failureCode:
  "PROMPT_FAILED", surfaced: true }`
- **WHEN** another agent pass fails with the same `failureCode`
- **THEN** the persisted `agentRun.surfaced` remains true
- **AND** `driveTaskLoop()` returns `prompted: false` for the same
  `WAIT_USER` decision

#### Scenario: A different terminal signal may surface again

- **GIVEN** a task whose `surfaced` marker belongs to `PROMPT_FAILED`
- **WHEN** the next pass fails with `AGENT_TIMEOUT`
- **THEN** `surfaced` resets to false
- **AND** the new signal can be surfaced once

#### Scenario: New authorization token still surfaces

- **GIVEN** the loop's `lastDecision` is `WAIT_AUTHORIZATION`
- **WHEN** a new authorization token is pending
- **THEN** `driveTaskLoop()` prompts even though the decision name repeats

### Requirement: Consecutive agent failures are bounded

`agentRun` MUST track `failureStreak`; it increments on a failed agent run
and resets on a non-failed run or when a real user message reopens the run.
`shouldRunTaskAgentPass()` MUST return false when
`failureStreak >= taskLoop.agents.maxConsecutiveFailures` (default 3), so no
new child session is created until the user intervenes.

#### Scenario: Fourth consecutive failure is not attempted

- **GIVEN** `agentRun = { status: "FAILED", failureStreak: 3 }` and the
  configured budget is 3
- **WHEN** `shouldRunTaskAgentPass()` is evaluated
- **THEN** it returns false
- **AND** no child agent session is created

#### Scenario: Successful run resets the streak

- **GIVEN** `failureStreak` is 2
- **WHEN** an agent run completes without failure
- **THEN** the persisted `failureStreak` is 0

#### Scenario: User message resets the budget

- **GIVEN** `agentRun = { status: "FAILED", failureStreak: 3 }`
- **WHEN** a genuine user message calls `reopenTerminalAgentRun()`
- **THEN** `failureStreak` becomes 0
- **AND** a new pass is allowed
