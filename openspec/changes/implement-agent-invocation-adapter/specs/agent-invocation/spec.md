# Agent invocation

## ADDED Requirements

### Requirement: Provider-neutral invocation boundary

WAM MUST expose an adapter with one `invoke(AgentRequest)` operation that returns
an `AgentResult` plus transport metadata. `AgentRequest` and `AgentResult` MUST
remain free of OpenCode session IDs, model names and host payloads.

#### Scenario: Result metadata stays outside the contract

- **WHEN** an invocation completes
- **THEN** the validated `AgentResult` contains only Change 01 fields
- **AND** the child `sessionID` is returned as separate metadata

### Requirement: OpenCode V1 child-session invocation

The OpenCode V1 adapter MUST create a child session, send exactly one prompt and
wait for its response. The prompt MUST carry the role system instruction, the
request payload and the role tool policy. The adapter MUST NOT require persistent
per-role OpenCode agent configuration.

#### Scenario: Child session per invocation

- **WHEN** a valid `BUILDER` request is invoked
- **THEN** the adapter creates a session titled with task, invocation and role
- **AND** it prompts that session once

#### Scenario: Optional host agent

- **WHEN** the caller supplies an agent name
- **THEN** the adapter forwards it in the prompt body
- **AND** the role instruction still comes from the WAM request

### Requirement: Capability-derived tool policy

The adapter MUST derive the host tool policy from `ROLE_CAPABILITIES`.
Read-only roles MUST disable `bash`, `edit`, `write` and `patch`. Only the
Builder MAY enable `bash`, `edit`, `write` and `patch`. Every role MUST disable
`task` and `todowrite`.

#### Scenario: Reviewer cannot mutate

- **WHEN** a `REVIEWER` request is invoked
- **THEN** mutating tools are disabled in the prompt body

#### Scenario: Builder cannot recurse

- **WHEN** a `BUILDER` request is invoked
- **THEN** `task` and `todowrite` are disabled

### Requirement: Strict result parsing

The adapter MUST accept exactly one JSON `AgentResult`, optionally inside one
Markdown code fence. It MUST validate the result with `assertAgentResult` and MUST
reject results whose `taskId`, `invocationId` or `role` differ from the request.
The adapter MUST NOT repair, coerce or synthesize a result.

#### Scenario: Identity mismatch

- **WHEN** the model returns a different `invocationId`
- **THEN** invocation fails with an invalid-result error

#### Scenario: Agent declares DONE

- **WHEN** the model returns `status: "DONE"`
- **THEN** invocation fails with an invalid-result error

### Requirement: Fail-loud host errors

Session creation, prompt execution and output parsing failures MUST throw
`AgentInvocationError` with a stable code. The adapter MUST NOT convert a host
error into a `FAILED` agent result.

#### Scenario: Prompt transport failure

- **WHEN** `session.prompt` rejects
- **THEN** the adapter throws `PROMPT_FAILED`
- **AND** includes the child `sessionID` when known

### Requirement: No state authority

The adapter MUST NOT write WAM task state, approvals, evidence or completion.
Child sessions MUST NOT be treated as a source of truth for WAM.

#### Scenario: Completed agent result

- **WHEN** an agent returns `status: "COMPLETED"`
- **THEN** WAM state is unchanged
- **AND** completion remains a WAM decision
