# Tasks: iterate-agent-friction

## 1. Failure classification

- [x] 1.1 Classify timeout/abort causes as `PROMPT_TIMEOUT` in
  `src/agents/invocation-adapter.js`; keep cause and status.
- [x] 1.2 Add `isRetryableAgentError(error)` in
  `src/execution/task-agent-run.js`.

## 2. Bounded retry

- [x] 2.1 Add `maxAttempts` to `runTaskAgentStep` and
  `runConfiguredTaskAgentStep`; retry retryable failures with narrowed
  `maxChars` and a prior-failure constraint.
- [x] 2.2 Persist `failureCode` and `attempts` via `applyAgentFailure`.
- [x] 2.3 Parse `taskLoop.agents.maxAttempts` (default 2,
  `WAM_AGENT_MAX_ATTEMPTS`) in `src/config/wam-config.js` and pass it from
  `index.js`.

## 3. Soft-fail

- [x] 3.1 Map terminal `FAILED` to `WAIT_USER` with an actionable reason in
  `decideAgentLoopAction`; keep `BLOCK` for authorization/task-blocked.
- [x] 3.2 Keep `shouldRunTaskAgentPass` resumable after a soft-fail.

## 4. ANALYZE iteration

- [x] 4.1 Replace immediate exhaustion in the ANALYZE branch of
  `src/agents/orchestrator.js` with a bounded revision/replan loop that feeds
  reviewer findings back as constraints.
- [x] 4.2 Record revision/replan handoffs with the original review findings.

## 5. Tests

- [x] 5.1 Unit: ANALYZE iterates once and accepts; exhausts after the limit.
- [x] 5.2 Unit: retryable timeout is retried, narrowed, then succeeds.
- [x] 5.3 Unit: retry exhaustion yields `WAIT_USER`, not `BLOCK`.
- [x] 5.4 Update existing FAILED/BLOCK and ANALYZE-exhausted assertions.

## 6. Validation

- [x] 6.1 `node --test --test-force-exit` on the affected files.
- [x] 6.2 `openspec validate --changes --strict`.
- [x] 6.3 `npm run build` and load-check `dist/`.
- [x] 6.4 Fresh `opencode web` session against an isolated fixture: the agent
  pass iterates or succeeds and does not emit `BLOCK (agent-failed ...)`.
