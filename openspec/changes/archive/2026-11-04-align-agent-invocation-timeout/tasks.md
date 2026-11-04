# Tasks — align agent invocation timeout

- [x] Use `AGENT_RESOURCE_LIMITS.maxInvocationMs` as the adapter default timeout.
- [x] Classify aborted prompts as `PROMPT_TIMEOUT`.
- [x] Persist the error code and cause chain in `agentRun.failureReason`.
- [x] Add regression tests for the abort classification and the failure formatter.
- [x] Run affected tests, `openspec validate --changes --strict`, `npm run build` and
      the `dist/` load-check.
