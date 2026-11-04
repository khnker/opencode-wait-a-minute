# Design — align agent invocation timeout

## Research

- AbortSignal semantics: a signal created by `AbortSignal.timeout(ms)` aborts once,
  `ms` after creation; reusing it for a second request keeps the original deadline
  (https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).
- `Promise.race` resolves with the first settled promise, so when both the SDK request
  and a timeout timer reject at the same deadline the winner is not deterministic
  (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race).
- The orchestrator documents `maxInvocationMs: 300000` in
  `src/agents/resource-policy.js`; the adapter hard-coded `120000`.

## Decision

Make `AGENT_RESOURCE_LIMITS.maxInvocationMs` the single default deadline and detect
aborts explicitly so a deadline is reported as `PROMPT_TIMEOUT`, not `PROMPT_FAILED`.

## Alternatives considered

1. **Adapter owns no timeout, orchestrator always enforces.**
   Rejected: standalone adapter use (tests, other hosts) would be unbounded.
2. **Thread `maxInvocationMs` through the request.**
   Rejected: `assertAgentRequest` is strict and this adds contract surface for a
   value that is already globally defaulted; revisit if per-role limits are needed.
3. **Raise the constant only.**
   Rejected: the failure taxonomy would still mislabel timeouts.

## Implementation

- Import `AGENT_RESOURCE_LIMITS` in `src/agents/invocation-adapter.js` and use
  `maxInvocationMs` as the default when `toolTimeoutMs` is not supplied.
- In the prompt catch, detect `AbortError`/`ABORT_ERR`/`signal.aborted` and throw
  `AgentInvocationError(..., { code: PROMPT_TIMEOUT })` with the timeout message.
- Add `formatAgentFailure(error)` in `src/execution/task-agent-run.js`; include the
  message, `code`, and up to three cause messages in `failureReason`.
- Regression tests cover the abort classification and the formatted cause chain.

## Residual risk

If a host overrides `resourceLimits.maxInvocationMs` above the adapter default without
overriding `toolTimeoutMs`, the adapter still caps at 300 s. Both values live in the
same module, so the mismatch is visible in review.
