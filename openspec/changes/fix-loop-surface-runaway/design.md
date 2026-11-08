# Design: Fix Loop Surface Runaway

## 1. Context and evidence

Forensics from the production database and
`~/.local/share/opencode/log/opencode.log`:

- Parent `ses_e58d835c5ffe1lwzlWAvrfSYBL`, directory
  `/home/nicolas/dev/wait-a-minute-plugin`.
- `message=loop session.id=ses_e58d... step=0` every ~0.7 s from
  `2026-11-04T15:22:45Z` to `2026-11-05T12:21:51Z`.
- Two `WAM ANALYST …` child sessions per cycle (`maxAttempts: 2`).
- `.wam/tasks/task-necesito-ver-como-esta-funcionando-el-flujo-de-sess-AvrfSYBL/`:
  `loop-state.json` stayed `WAITING_USER`, `iteration: 0`,
  `consecutiveNoProgress: 0`; `loop-events.jsonl` had 7,307 decisions.
- `task.json` always ended with `agentRun.failureCode: "PROMPT_FAILED"`,
  `attempts: 2`, `surfaced: false`; `autoLoop: null`.

Relevant code paths:

- `src/execution/task-loop.js:243` `buildTaskLoopPrompt()`.
- `src/integration/part-provenance.js:116` `isWamSynthetic()`.
- `src/integration/message-handler.js:250` `extractPrompt()` and `:418`
  `reopenTerminalAgentRun()`.
- `src/execution/agent-run-state.js:14` `agentSignalForLoop()` and `:33`
  `reopenTerminalAgentRun()`.
- `src/execution/task-agent-run.js:265` `applyAgentRun()` and `:411`
  `shouldRunTaskAgentPass()`.
- `src/adapters/opencode-v1/session-driver.js:157` `needsUserSurface`.

## 2. Research

- OpenCode plugin hook contract (`chat.message` runs before a user turn and
  can receive plugin-injected parts):
  https://opencode.ai/docs/plugins
- OpenCode server/session prompt API (prompts are persisted as user
  messages): https://opencode.ai/docs/server
- Idempotency / re-entrancy guards for self-generated messages:
  https://martinfowler.com/articles/patterns-of-distributed-systems/idempotent-receiver.html
- Circuit breaker for repeated downstream failures (stop calling a failing
  dependency after a threshold, reset only on a real recovery signal):
  https://martinfowler.com/bliki/CircuitBreaker.html
- Node.js abort/timeout primitives used by the agent adapter:
  https://nodejs.org/api/globals.html#class-abortsignal

The key insight from the docs is that a plugin must be able to distinguish
its own injected content from user content; otherwise any self-prompt is a
new "user turn" and resets the exact state that is meant to stop the loop.

## 3. Alternatives considered

### A. Only tag the loop prompt as WAM-synthetic (rejected)

Tagging fixes the `chat.message` re-open, but `applyAgentFailure()` still
drops `surfaced` on the next failed pass, so the next idle re-surfaces. It
also leaves the unbounded child-session retries in place.

### B. Only preserve `surfaced` across passes (rejected)

This stops the repeated prompt in the common path, but a synthetic loop
prompt still resets `agentRun` via `reopenTerminalAgentRun()` on every cycle.
It also leaves the 7,300 child passes unbounded.

### C. Provenance tag + sticky surface + failure budget (chosen)

Three small, orthogonal guards:

1. `buildTaskLoopPrompt()` marks its part with `metadata.wam = true`, so
   `extractPrompt()` returns empty and the handler returns before
   `reopenTerminalAgentRun()`.
2. `applyAgentRun()` and `agentSignalForLoop()` carry `surfaced` forward when
   the previous and next runs describe the same terminal signal. A real user
   message still resets it through `reopenTerminalAgentRun()`.
3. `agentRun.failureStreak` increments on consecutive failed passes and
   `shouldRunTaskAgentPass()` refuses to start another pass once
   `maxConsecutiveFailures` (default 3) is reached. `reopenTerminalAgentRun()`
   resets the streak on the next genuine user message.

The `driveTaskLoop` repeated-decision guard is kept as a fourth,
loop-state-level safety net; it is auth-token aware so a *new* authorization
request can still surface.

### D. Disable agent passes / task loop by default (rejected)

It hides the bug and removes the feature. The goal is bounded autonomy, not
disabling it.

## 4. Decision details

### Terminal signal identity

A run is terminal when `exhausted === true` or `status` is one of `BLOCKED`,
`NEEDS_INPUT`, `FAILED`. Two runs are "the same signal" when `status`,
`verdict`, `exhausted` and `failureCode` match. `surfaced` is carried forward
only for the same signal; a different failure or a successful run starts with
`surfaced: false`.

### Failure budget

`failureStreak` counts consecutive failed agent outcomes (status `FAILED` or
`stoppedAt === "agent"`). Any non-failed run resets it to 0. The budget is
checked before a pass starts, not after, so a reached budget creates no new
child session.

### Why not count WAIT_USER as stagnation?

`WAIT_USER` is a legitimate resting state: no loop work is happening. The
runaway came from re-prompting, not from the decision itself. Incrementing
`consecutiveNoProgress` on `WAIT_USER` would stop healthy tasks that are
waiting for the user. The bounded surface/failure guards target the actual
side effects.

## 5. Risks

- A genuine new failure with the same `failureCode` after a user message will
  surface once per user turn (intended).
- If a user sends several messages while the agent keeps failing, each turn
  gets at most `maxConsecutiveFailures` passes (3 by default).
- Existing tasks with an `agentRun` object that lacks `failureStreak` are
  treated as streak 0, so behavior is unchanged until the first failure.
