# Autonomous execution loop

## ADDED Requirements

### Requirement: Session lifecycle initialization

WAM state MUST be initialized on `session.created` and cleaned up on
`session.deleted`. If initialization is deferred to the first message, the
session contract MUST explicitly document first-message initialization. State
initialization MUST be idempotent per session id.

#### Scenario: State initialized on session creation

- **WHEN** `POST /session` triggers the `session.created` hook
- **THEN** WAM state is initialized for that session id
- **AND** a repeated creation for the same id does not duplicate state

#### Scenario: State cleaned up on deletion

- **WHEN** the `session.deleted` hook fires for a session
- **THEN** that session's task and loop state is removed

#### Scenario: Documented first-message fallback

- **WHEN** initialization is deferred to the first message instead of
  `session.created`
- **THEN** the session contract documents first-message initialization
- **AND** a regression test asserts the documented behavior

### Requirement: Loop completion releases the session

Once the task phase is DONE and verified, the loop MUST NOT schedule further
turns and MUST NOT leave the parent session `busy` waiting on child agents.
Terminal `loop-state.json` values MUST be consistent with an idle session.

#### Scenario: Completed task stops scheduling turns

- **WHEN** the task reaches `phase: DONE` and passes verification
- **THEN** `loop-state.json` records a terminal state (`COMPLETED`,
  `lastDecision: COMPLETE`)
- **AND** no further turn is scheduled

#### Scenario: Completed task leaves the session idle

- **WHEN** the loop completes with pending child agents
- **THEN** the pending child agents are cancelled and awaited
- **AND** the parent session transitions to idle rather than staying `busy`

#### Scenario: Synchronous message returns after completion

- **WHEN** a client sends `POST /session/{id}/message` and the loop completes
- **THEN** the request returns instead of hanging until an external abort

### Requirement: Bounded tool execution

Every WAM child/subagent tool call MUST have a timeout. Tool paths MUST resolve
relative to the session `projectRoot`, and absolute paths outside `projectRoot`
MUST be rejected rather than executed.

#### Scenario: Hanging tool call is aborted

- **WHEN** a child tool call exceeds the configured timeout
- **THEN** it is aborted via an `AbortSignal` timeout
- **AND** the abort is logged with the offending path

#### Scenario: Relative path resolves under projectRoot

- **WHEN** a child tool call uses a relative pattern such as `*`
- **THEN** it resolves relative to the session `projectRoot`
- **AND** it does not read the plugin repository

#### Scenario: Absolute path outside projectRoot is rejected

- **WHEN** a child tool call targets an absolute path outside `projectRoot`
- **THEN** the call is rejected
- **AND** the rejection is logged

### Requirement: Agent/main-turn coordination

WAM task agents MUST NOT evaluate state produced before the main turn finishes.
ANALYST evidence MUST be taken after the main turn's mutations settle, or be
explicitly marked `stale` and refused.

#### Scenario: ANALYST sees main-turn mutations

- **WHEN** the main turn creates a file and ANALYST then runs
- **THEN** ANALYST observes the created file
- **AND** it does not report that the file does not exist

#### Scenario: Pre-turn evidence is marked stale

- **WHEN** evidence was captured before the main turn completed
- **THEN** it is marked `stale`
- **AND** no agent derives a mutation from it

#### Scenario: Main turn and agents do not duplicate work

- **WHEN** the main turn and a child agent would apply the same mutation
- **THEN** the mutation is applied once under explicit ownership

### Requirement: Permission preflight blocks writes when pending

In non-advisory mode, a `pending` permission MUST block mutating tools. Advisory
mode behavior MUST remain unchanged.

#### Scenario: Pending permission blocks a write in non-advisory mode

- **WHEN** `permissionPreflight.edit` is `pending` and the mode is non-advisory
- **THEN** mutating tools are blocked
- **AND** no write proceeds

#### Scenario: Approved permission allows a write

- **WHEN** `permissionPreflight.edit` is approved and the mode is non-advisory
- **THEN** mutating tools execute normally

#### Scenario: Advisory mode is unchanged

- **WHEN** the mode is advisory and `permissionPreflight.edit` is `pending`
- **THEN** writes proceed as before
- **AND** no new blocking is introduced

### Requirement: Dashboard has no dead export

`startWebDashboard` MUST either be wired into the runtime or removed. If kept, it
MUST be documented as read-only and reachable through an explicit opt-in, with
no dead export remaining.

#### Scenario: Dashboard is wired behind a flag

- **WHEN** the dashboard is kept
- **THEN** `startWebDashboard` is called from the runtime behind an opt-in flag
  that defaults off
- **AND** its GET-only read-only contract (`GET /api/sessions`, `GET
  /api/session`) is documented

#### Scenario: Dashboard is removed

- **WHEN** the dashboard is not wired
- **THEN** the module and its export are deleted
- **AND** no caller or test references `startWebDashboard`

### Requirement: Stagnation and verification precedence

The loop MUST document and enforce that `STOP_STAGNATION` is evaluated before
`VERIFY`, bounding verification loops without prematurely stopping tasks whose
progress detection failed.

#### Scenario: Stagnation stops before verification

- **WHEN** the loop detects stagnation
- **THEN** `STOP_STAGNATION` is applied before `VERIFY`
- **AND** the loop does not re-enter unbounded verification

#### Scenario: Progress still reaches verification

- **WHEN** the loop detects progress
- **THEN** `VERIFY` still runs
- **AND** the task is not stopped prematurely
