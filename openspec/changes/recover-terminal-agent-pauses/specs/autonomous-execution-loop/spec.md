# Autonomous execution loop

## ADDED Requirements

### Requirement: A terminal pause is surfaced exactly once

The host MUST emit one synthetic prompt when the loop decides `WAIT_USER`,
`WAIT_AUTHORIZATION`, `BLOCK`, `STOP_BUDGET` or `STOP_STAGNATION`, stating
the reason and the actionable context: the pending verification
items and the latest reviewer findings for `WAIT_USER`, the pending
authorization id for `WAIT_AUTHORIZATION`, the block reason for `BLOCK`, and
the stop reason for `STOP_BUDGET`/`STOP_STAGNATION`. The host MUST NOT emit the
same pause again while the pause remains the same. The host MUST ignore a
pending authorization when the contract is already approved: an approved plan
does not need another authorization gate.

#### Scenario: Agent revision budget exhausted

- **WHEN** the persisted `agentRun` has `exhausted: true` and
  `shouldRunTaskAgentPass` skipped the pass
- **AND** the loop decision is `WAIT_USER` with reason
  `agent-revision-exhausted`
- **THEN** the host emits one synthetic prompt containing the reviewer findings
  and the pending requirement
- **AND** it persists `agentRun.surfaced = true`
- **AND** the next `session.idle` with the same state does not emit another
  prompt

#### Scenario: Contract not approved

- **WHEN** the loop transitions from a non-`WAIT_USER` decision to
  `WAIT_USER` because the contract is not approved
- **THEN** the host emits one synthetic prompt
- **AND** a later idle that still decides `WAIT_USER` stays silent

#### Scenario: Pending authorization

- **WHEN** the task has a pending authorization, the contract is not approved,
  and the loop decides `WAIT_AUTHORIZATION`
- **THEN** the host emits one synthetic prompt naming the authorization id
- **AND** it persists `authorizationSurfacedId` with that id
- **AND** a later idle that still decides `WAIT_AUTHORIZATION` stays silent

#### Scenario: Approved contract ignores a pending authorization

- **WHEN** the task contract is `APPROVED` and a stale pending authorization is
  still persisted
- **THEN** the loop does not decide `WAIT_AUTHORIZATION`
- **AND** it continues with the remaining work without another gate

#### Scenario: User replies after a pending authorization

- **WHEN** the host already surfaced a pending authorization
- **AND** the user sends a real message
- **THEN** the handler clears `authorizationSurfacedId`
- **AND** the next idle surfaces the still-pending authorization once more

#### Scenario: Loop stops on budget or stagnation

- **WHEN** the loop decides `STOP_BUDGET` or `STOP_STAGNATION`
- **THEN** the host emits one synthetic prompt with the stop reason
- **AND** the next idle with the same stopped loop stays silent

#### Scenario: Failed agent pass

- **WHEN** the persisted `agentRun` has `status: "FAILED"` and the loop decides
  `BLOCK` with reason `agent-failed`
- **THEN** the host emits one synthetic prompt with the block reason
- **AND** it persists `agentRun.surfaced = true`
- **AND** the next idle with the same state stays silent

### Requirement: A stale agent outcome does not drive the loop as fresh

`runTaskAgentPass` MUST feed the loop the fresh outcome when the pass ran. When
the pass was skipped, it MUST feed an explicit `needs-user` marker for
`exhausted`/`BLOCKED`/`NEEDS_INPUT`/`FAILED` runs and MUST NOT feed a stale
accepted outcome. `isTerminalAgentSignal` MUST report `true` for exactly those
markers and `false` for accepted or healthy runs.

#### Scenario: Skipped exhausted pass

- **WHEN** `runConfiguredTaskAgentStep` returns `null` and the persisted run is
  exhausted
- **THEN** the loop receives a marker with `stale: true`, `exhausted: true`,
  the verdict and the reviewer results
- **AND** the decision remains `WAIT_USER` with the exhaustion reason

#### Scenario: Skipped accepted pass

- **WHEN** the persisted run is accepted and the pass was skipped
- **THEN** the loop receives no agent outcome and decides from the completion
  gate and task progress

### Requirement: A real user message reopens a terminal run

A real, non-synthetic user message MUST clear a terminal agent run so the next
pass can run: `status`, `verdict` and `stoppedAt` set to `null`,
`exhausted = false`, `surfaced = false`, and the revision cycles reset to zero.
It MUST also clear `authorizationSurfacedId` so a still-pending authorization
can be surfaced again. A terminal run is one with `exhausted: true` or `status`
in `BLOCKED`/`NEEDS_INPUT`/`FAILED`. Synthetic WAM prompts MUST NOT trigger
this reset.

#### Scenario: User replies after exhaustion

- **WHEN** a task has `agentRun.exhausted = true`
- **AND** the user sends a real message
- **THEN** the handler persists `agentRun.exhausted = false`,
  `agentRun.surfaced = false`, empty status/verdict and
  `cycles = { revisions: 0, replans: 0 }`
- **AND** it clears `authorizationSurfacedId`
- **AND** `shouldRunTaskAgentPass` returns `true` for the next idle

#### Scenario: User replies after a blocked, needs-input or failed run

- **WHEN** a task has `agentRun.status` in `BLOCKED`/`NEEDS_INPUT`/`FAILED`
- **AND** the user sends a real message
- **THEN** the handler persists `agentRun.status = null`,
  `agentRun.verdict = null`, `agentRun.stoppedAt = null`,
  `agentRun.exhausted = false` and `agentRun.surfaced = false`
- **AND** `shouldRunTaskAgentPass` returns `true` for the next idle

#### Scenario: Synthetic loop prompt

- **WHEN** the only text parts are synthetic WAM injections
- **THEN** `extractPrompt` returns an empty string and the handler does not
  reopen the run
