# Verification

## Unit

The exact response that blocked the live task loop (fenced JSON with a literal
newline inside a string) was replayed through `parseAgentResultText`:

```
PARSED ANALYST COMPLETED 6
```

Regression suite:

```
node --test --test-force-exit tests/unit/agent-invocation-adapter.test.mjs
# 32 passed, 0 failed
```

## Fresh-session web E2E

```
npm run verify:web -- --out /tmp/wam-task-json-web-1793844317 --model opencode/gemini-3.8-flash
```

- Result: **PASS**, 11/11 checks, 68.9 s
- Server: `http://127.0.0.1:46829` (fresh process, pid 1924713)
- Fixture: `/tmp/wam-web-e2e-fixture-mtG0cW`
- Session: `ses_e568be607ffedTwjdA8uRjVWYB`
- Roles observed: `REVIEWER`, `BUILDER`, `ARCHITECT`, `ANALYST`
- Loop: `phase=DONE`, `agentRun.status=COMPLETED`, `gate.active=false`
- Artifacts: `task.json=true`, `loop-state.json=true`
- Report: `/tmp/wam-task-json-web-1793844317/report.md`

Checks: server-ready, session-created, contract-approved, agent-pass-ran,
agent-pass-settled, loop-complete, failure-surfaced, no-empty-response,
artifacts-present, skills-injected, roles-observed.

The first attempt used the default (slower) model and hit the harness's 180 s
prompt-request timeout before the task loop ran (`prompt-request-timeout`,
6/11 checks); that run exercised no parser code. The rerun above with a flash
model completed the real agent loop.

## Residual risk

- The repair only escapes control characters while inside a JSON string and
  only extracts balanced `{...}` objects; text with no object still throws
  `agent response is not valid JSON`.
- A response that is complete prose with no JSON object is still rejected, as
  required by the role contract.
