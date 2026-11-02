# Design: Agent Invocation Adapter

## Research

- OpenCode SDK session API:
  https://opencode.ai/docs/sdk — `session.create({ body })` and
  `session.prompt({ path, body })`.
- OpenCode V1 SDK types:
  https://github.com/anomalyco/opencode/blob/v1.19.4/packages/sdk/js/src/gen/types.gen.ts
  — `SessionPromptData.body` supports `agent`, `system`, `tools`, `parts` and
  `noReply`; `SessionCreateData.body` supports `parentID` and `title`.
- OpenCode agent model:
  https://opencode.ai/docs/agents/ — agents can be selected per prompt and tools
  can be disabled per session prompt.

## Alternatives Considered

1. **Prompt the current session with a role preamble.** Rejected: the role shares
   the coordinator's conversation, so context and tool history bleed between
   roles; it also cannot express independent review.
2. **Create persistent per-role OpenCode agent files and invoke with `agent`.**
   Rejected: roles would drift from WAM contracts, require host-specific
   configuration and contradict on-demand role definition.
3. **Create a child session per invocation and prompt it with `system` plus
   `tools`.** Chosen: one isolated session per role, no persistent host config,
   and the host can remove mutating tools for read-only roles.

## Invocation Flow

1. Validate the incoming `AgentRequest` with Change 01's `assertAgentRequest`.
2. Create a child session titled with task, invocation and role.
3. Build a role system prompt from `ROLE_DEFINITIONS`, the request and the output
   contract.
4. Send `session.prompt` with the system prompt, a text part, the role tool
   policy and an optional caller-supplied agent name.
5. Extract text parts, parse exactly one JSON object and validate it with
   `assertAgentResult`.
6. Reject results whose `taskId`, `invocationId` or `role` differ from the
   request.
7. Return `{ result, metadata: { sessionID } }`.

## Tool Policy

The policy is derived from `ROLE_CAPABILITIES`; it is not a second source of
truth.

| Capability | Analyst | Architect | Builder | Reviewer |
| --- | --- | --- | --- | --- |
| read / grep / glob / list | on | on | on | on |
| webfetch | on | on | on | on |
| bash / edit / write / patch | off | off | on | off |
| task | off | off | off | off |
| todowrite | off | off | off | off |

`task` stays off so a role cannot recursively delegate. The policy is a host
guard, not a sandbox: Change 03 owns context isolation and stronger runtime
containment.

## Output Handling

The model must return one JSON object, optionally inside a single Markdown code
fence. Prose, multiple objects and partial JSON are invalid. Invalid output is
never repaired or coerced into a result.

The adapter adds no `sessionID`, `rawText`, model name or host payload to
`AgentResult`. Transport metadata is returned separately.

## Error Handling

`AgentInvocationError` carries a stable `code` and optional `sessionID`:

- `SESSION_CREATE_FAILED`
- `PROMPT_FAILED`
- `INVALID_RESULT`

Invalid requests remain `RoleContractError` because they are caller bugs.
Host errors fail loud; the adapter does not synthesize a `FAILED` result.

## Risks

- `tools` is an OpenCode guard, not a security boundary. A role with `bash` can
  still reach the filesystem.
- Child sessions and their transcripts grow; retention is outside this change.
- A model that ignores the JSON instruction produces invalid output rather than
  a best-effort result. Change 05 may add bounded repair or retry.
- No timeout is imposed by the adapter; callers pass an abort signal when needed.
