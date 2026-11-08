## 1. Implementation

- [x] Detect nested session errors before parsing the agent result.
- [x] Raise `PROMPT_FAILED` with provider message, status and `cause`.

## 2. Verification

- [x] Unit test for `{ info: { error }, parts: [] }` responses.
- [x] `node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs tests/unit/agent-orchestrator.test.mjs tests/unit/task-agent-loop.test.mjs` (75 pass).
- [x] Fresh-session `opencode web` fixture (port 5011, `/tmp/wam-verify-fresh`): the loop completed ANALYST→ARCHITECT→BUILDER→REVIEWER, phase `DONE`, both requirements verified, gate cleared at `2026-11-04T22:27:14.476Z`.
- [ ] E2E reproduction of a provider 503 was not achieved (the router recovered before the restart); that path is covered by the unit test and the `info.error` response shape captured from the fixture.
- [x] `npx openspec validate --changes --strict` (144 pass) and `npm run build`.
