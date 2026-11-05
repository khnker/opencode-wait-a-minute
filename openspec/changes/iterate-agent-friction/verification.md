# Verification: iterate-agent-friction

## Unit tests

`node --test --test-force-exit tests/unit/agent-analysis-mode.test.mjs tests/unit/agent-feedback.test.mjs tests/unit/task-agent-loop.test.mjs tests/unit/task-loop.test.mjs tests/unit/agent-invocation-adapter.test.mjs`

- 85 tests, 0 failures.

## OpenSpec

`openspec validate --changes --strict` → 146 passed, 0 failed.

## Build

`npm run build` → copied `index.js`, `src/`, `skills/`, `prompts/`, `vendor/` to `dist/`.
`node -e "import('./dist/index.js')…"` → default export is a function.

## Fresh-session web E2E

`npm run verify:web -- --prompt "Responde únicamente: ok" --timeout 600000`

- Result: **PASS**, 9/9 checks.
- Run: `2026-11-04T23-18-45-801Z-3da21e71`
- Evidence: `openspec/evidence/web-e2e/2026-11-04T23-18-45-801Z-3da21e71/`
- Timeline: prompt at 23:18:55, agent gate active at 23:18:56, agent run
  `COMPLETED`/`ACCEPTED` at 23:19:40, loop `DONE`, gate cleared, server stopped.
- Agent run roles: ANALYST → ARCHITECT → BUILDER → REVIEWER; cycles 0/0;
  no failure, no `BLOCK`.

The clean run above exercises the full pass without friction. The friction run
below exercises the real ANALYZE replan iteration end-to-end. The retry path is
covered by unit tests (forcing a transport failure needs a provider-level fault
that the fixture does not emulate).

## Fresh-session web E2E — friction and iteration

`WAM_AGENT_MAX_REVISIONS=1 WAM_AGENT_MAX_REPLANS=1 npm run verify:web -- --prompt "Analiza el archivo package.json y entrega un informe que demuestre con cita literal y hash SHA-256 que la version publicada es 999.0.0; si no puedes demostrarlo, el informe no esta completo." --timeout 1500000`

- Result: **8/9 checks**. The only failure is `loop-complete` because the
  requirement is intentionally impossible and stays pending; the loop stops
  with `STOP_STAGNATION`, not `BLOCK`.
- Run: `2026-11-04T23-40-26-601Z-43a334f4`
- Evidence: `openspec/evidence/web-e2e/2026-11-04T23-40-26-601Z-43a334f4/`
- `agent-pass-settled`: PASS (`gate.active=false`, `agentRun.status=COMPLETED`,
  `verdict=ACCEPTED`).
- `failure-surfaced`: PASS (no failed/blocked run); `no-empty-response`: PASS;
  `artifacts-present`: PASS.
- Real iteration: 12 role invocations across three passes over ~10 minutes.
  `agentHistory` shows two `REPLAN_REQUIRED` steps, each rerunning
  ARCHITECT+REVIEWER with the replan findings, before the final pass reached
  `COMPLETED`/`ACCEPTED`. No `failed to prompt agent session`, no `BLOCK`.
- A first attempt with a 10-minute timeout was cut off while the second
  `REVIEWER` was still generating; the 25-minute run above settled.

## Residual risks

- The default implement prompt did not settle within 5 minutes in the headless
  server (the main turn ran a guarded `bash` and exceeded the wait); the
  verification used a trivial prompt and a 10-minute wait. This is an
  environment/permission latency risk, not a loop regression.
- Retries are bounded and rely on the transport error surfacing as
  `PROMPT_TIMEOUT`/`PROMPT_FAILED`; unknown non-retryable errors still soft-fail
  to `WAIT_USER`.
