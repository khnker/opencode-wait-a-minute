# Review artifacts visible to the reviewer

## Why

The agent loop normalizes `reviewArtifacts` and passes them to the reviewer
request, but `buildAgentUserPrompt` never renders them. The reviewer therefore
cannot see independent test logs or review evidence, and can accept a change
whose hidden tests fail.

## What Changes

- Render `reviewArtifacts` in the reviewer user prompt.
- Require `REVISION_REQUIRED` when a review artifact shows a failing test or a
  contradiction with the implementation, unless the reviewer explains why the
  artifact is stale and cites current evidence.
- Enforce that rule deterministically on the first review: an `ACCEPTED`
  verdict is overridden to `REVISION_REQUIRED` when a review artifact contains a
  failing-test marker, with a `CRITICAL` finding citing the artifact.
- Cover the prompt rendering, the reviewer rule, and the first-review gate with
  unit tests.

## Impact

- Affected spec: `agent-review-artifacts` (new capability delta).
- Affected code: `src/agents/invocation-adapter.js`,
  `src/agents/review-artifacts.js`, `src/agents/orchestrator.js`.
- No config or runtime default changes.
