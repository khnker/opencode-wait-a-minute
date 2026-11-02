# Tasks

## 1. Adapter

- [x] 1.1 Add `src/agents/invocation-adapter.js` with the provider-neutral `invoke` boundary.
- [x] 1.2 Build the role system prompt from the request and role definition.
- [x] 1.3 Derive the OpenCode tool policy from `ROLE_CAPABILITIES`.
- [x] 1.4 Create a child session, send one prompt and keep `sessionID` outside the result.
- [x] 1.5 Parse and validate exactly one `AgentResult`; reject identity mismatches.

## 2. Failure Behavior

- [x] 2.1 Fail loud with `AgentInvocationError` codes for session, prompt and output failures.
- [x] 2.2 Do not synthesize results or write WAM state from the adapter.

## 3. Tests

- [x] 3.1 Cover session creation, prompt payload and tool policy for every role.
- [x] 3.2 Cover fenced JSON, invalid JSON, invalid contract fields and identity mismatches.
- [x] 3.3 Cover host failures and missing client methods.
- [x] 3.4 Verify no persistent per-role agent configuration is required.

## 4. Validation

- [x] 4.1 Run `node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs`.
- [x] 4.2 Run `openspec validate --changes --strict`.
- [x] 4.3 Run `npm run build` and load-check `dist/`.
