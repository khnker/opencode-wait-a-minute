# autonomous-execution-loop Specification

## Purpose
TBD - created by archiving change autonomous-execution-loop. Update Purpose after archive.
## Requirements
### Requirement: Hypothesis-driven experiments
GUARDED mutations MUST carry `hypothesisId`. The execution engine MUST create a hypothesis before opening an experiment.

#### Scenario: GUARDED mutation requires hypothesis
- GIVEN a GUARDED action (e.g., write, edit, bash)
- WHEN the agent attempts to execute it
- THEN the system must require a `hypothesisId` in the arguments
- AND a hypothesis must be created before the experiment

### Requirement: No repetitive failures
The system MUST block any experiment whose `hypothesisId` and `actionDescription` matches a previously failed experiment. The agent MUST replan with a different hypothesis.

#### Scenario: Repetitive failure blocked
- GIVEN an experiment with hypothesis H1 and action A1 has failed
- WHEN the agent tries hypothesis H1 with action A1 again
- THEN `guardAction` returns `allowed: false`
- AND the hypothesis is archived

### Requirement: Risk classification enforced
`guardAction` MUST call `evaluateAction`.
WHEN level is `BLOCKED` THEN `allowed` MUST be false.
SAFE and in-scope GUARDED MAY proceed.

#### Scenario: BLOCKED action blocked
- GIVEN an action is classified as BLOCKED by the risk engine
- WHEN the agent attempts to execute it
- THEN `guardAction` returns `allowed: false` and the action is prevented

### Requirement: Non-destructive deletion (U1)
The system MUST NOT hard-delete cognition records, task sessions, or workspace paths as an autonomous action.
Archive = append status `archived` or move-to-history.
Hard-delete tools and commands (`rm`, `rmdir`, `git reset --hard`, `DROP TABLE`, `TRUNCATE`, shred/unlink) MUST be BLOCKED.

#### Scenario: Hard-delete blocked
- GIVEN the agent attempts to run `rm -rf /path` or `DROP TABLE`
- WHEN `guardAction` evaluates the command
- THEN the action is BLOCKED with reason "hard delete forbidden (U1: soft-archive only)"

### Requirement: Failed hypothesis preserved
Rejected/archived hypotheses MUST remain readable. Silent reuse of a rejected hypothesis is forbidden.

#### Scenario: Archived hypothesis readable
- GIVEN a hypothesis has been archived
- WHEN `listHypotheses` is called
- THEN the archived hypothesis is included in the results with status `archived`
- AND its history is preserved in the append-only JSONL

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
  `WAIT_USER` with reason `agent-failed`
- **THEN** the host emits one synthetic prompt with the failure reason
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

### Requirement: Retryable agent failures are bounded and surface to the user

When an agent pass throws, the host MUST persist a terminal `FAILED` run with the
failure reason and, when available, `failureCode` and `attempts`, instead of only
logging the error. Retryable invocation failures MUST be retried inside the pass up
to `taskLoop.agents.maxAttempts`, feeding the previous failure and a narrower
context to the next attempt. After exhaustion the loop MUST surface `WAIT_USER`
with `agent-failed: <detail>`; `BLOCK` is reserved for denied authorization and
task-blocked states.

#### Scenario: Retry then success

- **WHEN** an invocation fails with `PROMPT_TIMEOUT` or an aborted child session
  and the retry budget remains
- **THEN** the orchestration runs again with the previous failure as a constraint
  and a reduced context budget
- **AND** a successful retry returns the outcome with the attempts used

#### Scenario: Adapter error fails the pass

- **WHEN** `runTaskAgentPass` throws before returning an outcome
- **THEN** the task's `agentRun.status` is `FAILED`
- **AND** `agentRun.failureReason` contains the error message
- **AND** `agentRun.failureCode` and `agentRun.attempts` are persisted when available
- **AND** the loop decision is `WAIT_USER` with reason `agent-failed: <detail>`
- **AND** the host surfaces that reason once

#### Scenario: A real user turn reopens the failed run

- **WHEN** a real user message arrives after a persisted `FAILED` run
- **THEN** `reopenTerminalAgentRun` clears `status`, `verdict`, `surfaced` and
  `exhausted`
- **AND** the next idle can schedule a fresh pass

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

### Requirement: Agent failures preserve their cause

The system SHALL record the underlying provider error when an agent session
finishes with an error and no text, instead of reporting an empty response.

#### Scenario: Provider error without text parts

- **WHEN** the session prompt response contains `info.error` and no text parts
- **THEN** the invocation fails with `PROMPT_FAILED`
- **AND** the message includes the provider message and status code when present
- **AND** the original error is retained as `cause`
- **AND** the persisted loop failure reason includes that message

