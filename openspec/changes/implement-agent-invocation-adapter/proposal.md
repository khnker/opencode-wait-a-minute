# Implement Agent Invocation Adapter

## Why

Change 01 defines provider-independent agent contracts but nothing invokes them.
WAM needs a host adapter that turns an `AgentRequest` into an OpenCode V1
invocation and returns a validated `AgentResult`.

The adapter must keep OpenCode session types out of the contracts and must not
grant an agent authority that WAM owns: task state, approvals, evidence and
completion.

## What Changes

- Adds an `agent-invocation` capability boundary with a single `invoke` method.
- Adds an OpenCode V1 adapter that creates a child session and sends one prompt.
- Builds the role instruction from the WAM request, not from a persistent
  per-role OpenCode agent configuration.
- Derives the host tool policy from the declared capability matrix.
- Parses one JSON result, validates it with the Change 01 contract and rejects
  identity mismatches.
- Keeps transport metadata (`sessionID`) outside `AgentResult`.
- Fails loud on session creation, prompt execution or invalid model output.

## Impact

- `src/agents/invocation-adapter.js` (new)
- `tests/unit/agent-invocation-adapter.test.mjs` (new)
- `openspec/changes/implement-agent-invocation-adapter/**` (new)
- No Task Loop, orchestrator or completion-gate integration.

## Non-Goals

- Selecting or isolating context per role (Change 03).
- Routing work or orchestrating the four roles (Change 04).
- Review feedback cycles or automatic replanning (Change 05).
- Task Loop integration (Change 06).
- Multi-agent quality/cost benchmarking (Change 07).
- Persistent `wam-*` OpenCode agent configurations.
- Making child sessions a source of truth for WAM state.
