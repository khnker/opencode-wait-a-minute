# Tasks — Retry Transport Errors From Agent Prompts

## 1. Implementation

- [x] 1.1 Add `promptErrorFromResponse()` to `src/agents/invocation-adapter.js`
      and route raw prompt errors through it.
- [x] 1.2 Classify a missing status, 408, 409, 425, 429 and >= 500 as
      `PROMPT_FAILED` (retryable).
- [x] 1.3 Classify 400, 401, 403, 404 and 422 as `INVALID_RESULT` (terminal).
- [x] 1.4 Preserve `sessionID` and `cause` on the wrapped error.

## 2. Tests

- [x] 2.1 Add regression test: an HTTP 429 response error is retryable
      (`tests/unit/agent-invocation-adapter.test.mjs`).
- [x] 2.2 Add regression test: an HTTP 403 response error is not retryable
      (`tests/unit/agent-invocation-adapter.test.mjs`).

## 3. Verification

- [x] 3.1 `npm test` — 4413 tests, 4410 pass, 3 skipped.
- [x] 3.2 `openspec validate --changes --strict` — change passes.
- [x] 3.3 `npm run build` — succeeds.
- [x] 3.4 `node -e "import('./dist/index.js').then(()=>console.log('dist-load-ok'))"`
      — prints `dist-load-ok`.

## 4. Review

- [ ] 4.1 Human review of the classification table and change report
      (human-gated).
