# Tasks: Provide independent review artifacts

## 1. Review artifact contract

- [x] 1.1 Create `src/agents/review-artifacts.js` with `REVIEW_ARTIFACT_LIMITS`,
  `normalizeReviewArtifacts`, and `assertReviewArtifacts`.
- [x] 1.2 Reject invalid shapes and empty content with `RoleContractError`; dedupe by ref
  and bound entries/content deterministically.
- [x] 1.3 Add `reviewArtifacts` to `REQUEST_INPUT_KEYS` and validate it in
  `assertAgentRequest`.

## 2. Orchestration plumbing

- [x] 2.1 Accept `reviewArtifacts` in `runAgentOrchestration` and
  `runAgentFeedbackOrchestration` options and validate them.
- [x] 2.2 Attach `input.reviewArtifacts` only to REVIEWER requests and only when non-empty.
- [x] 2.3 Collect `task.reviewArtifacts`, `task.diff`, and `task.patch` in
  `buildTaskAgentInput`; pass the normalized array through `runTaskAgentStep`.

## 3. Verification

- [x] 3.1 Add `tests/unit/agent-review-artifacts.test.mjs` covering normalization, dedupe,
  bounds, and invalid shapes.
- [x] 3.2 Add orchestrator tests proving REVIEWER receives the supplied diff and
  non-REVIEWER roles do not.
- [x] 3.3 Add task-loop tests proving `task.diff` reaches the REVIEWER request.
- [x] 3.4 Run the targeted unit suites and `npm run build`.
