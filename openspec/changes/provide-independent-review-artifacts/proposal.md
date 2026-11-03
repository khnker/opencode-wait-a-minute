# Proposal: Provide independent review artifacts

## Why

The REVIEWER role receives only accumulated references (paths and ids) through the
context selector. It never receives the actual diff or patch content, so it can return
`ACCEPTED` without examining what changed. That makes the review step ceremonial: a
reviewer cannot verify correctness, scope, or security from a file path alone.

Google's code review guidance asks reviewers to evaluate the change itself, NIST SSDF
requires verification evidence independent of the author, and OWASP LLM06:2025 warns
against granting agency without independent oversight. Supplying bounded, real diff
content to the reviewer is the smallest deterministic fix.

## What Changes

- Add `src/agents/review-artifacts.js` with bounded normalization and validation for
  reviewer artifacts (`ref` + `content`).
- Allow `reviewArtifacts` as an optional orchestration input. Only REVIEWER requests
  receive `input.reviewArtifacts`; other roles never do.
- Validate `input.reviewArtifacts` in `assertAgentRequest` (array of bounded
  `{ ref, content }` objects).
- Collect `task.reviewArtifacts`, `task.diff`, and `task.patch` in
  `buildTaskAgentInput` and pass the normalized result to the feedback orchestration.
- Preserve existing behavior when no review artifacts are supplied: no request field is
  added and the orchestration inputs remain unchanged.

## Impact

- Affected specs: `agent-review-artifacts` (new capability).
- Affected code: `src/agents/review-artifacts.js`, `src/agents/role-contracts.js`,
  `src/agents/orchestrator.js`, `src/execution/task-agent-run.js`.
- No new dependencies and no behavior change for callers that omit review artifacts.
