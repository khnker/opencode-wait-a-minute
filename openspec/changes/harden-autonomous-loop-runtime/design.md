# Design: Harden Autonomous Loop Runtime

## 1. Context and evidence

The design is grounded in a real `opencode serve` session driven with curl
(see `proposal.md` for the full findings). Relevant code:

- `src/execution/task-agent-run.js` — child-session agent pipeline
  (ANALYST -> ARCHITECT -> BUILDER -> REVIEWER).
- `src/execution/task-loop.js` — loop decisions; the uncommitted hunk around
  lines 150-160 reorders `STOP_STAGNATION` before `VERIFY`.
- `src/integration/web-dashboard.js` — exports `startWebDashboard` with no
  callers; GET-only `/api/sessions` (~line 15) and `/api/session` (~line 67).
- `loop-state.json` — recorded `COMPLETED`, `iteration: 0`,
  `lastDecision: COMPLETE`, while the parent session stayed `busy`.
- The stuck tool call was
  `glob {pattern:"*", path:"/home/nicolas/dev/wait-a-minute-plugin"}` — an
  absolute path pointing at the plugin repo rather than the session
  `projectRoot`.

## 2. Research

Official documentation used to shape the requirements:

- OpenCode plugin lifecycle hooks (`session.created`, `session.deleted`, tool
  interception): https://opencode.ai/docs/plugins
- Node.js HTTP server semantics (`server.close`, keep-alive, idle sockets):
  https://nodejs.org/api/http.html
- Node.js timers and `AbortSignal.timeout` for bounded async work:
  https://nodejs.org/api/timers.html
- OpenCode server/session message API, synchronous vs async message posting:
  https://opencode.ai/docs/server
- SQLite VACUUM / bounded state growth (retention of `loop-state.json` and
  session artifacts): https://www.sqlite.org/lang_vacuum.html

`AbortSignal.timeout(ms)` is the preferred primitive for R3: it composes with
`fetch`/`spawn` cleanup and avoids unref'd timers that keep the event loop
alive. `http.Server.close()` semantics matter for R2 — a session cannot become
idle while a tool promise is still pending.

## 3. Alternatives considered

### Alternative A (rejected): fix only the stuck glob with a global timeout

Add one watchdog that aborts any tool call after N seconds.

- **Pros**: smallest diff; unblocks the observed hang.
- **Cons**: leaves duplicated main-turn/agent work (finding 3), stale ANALYST
  evidence (finding 3), pending permission executing writes (finding 2), late
  state init (finding 1), and the dead dashboard export (finding 6). The session
  would still report `COMPLETED` inconsistently (finding 4) and `STOP_STAGNATION`
  precedence would stay undocumented (finding 7).
- **Verdict**: rejected as insufficient. Timeout is necessary but not enough;
  it is folded into R3 rather than used as the whole change.

### Alternative B (rejected): make all agent work advisory and disable child sessions

Set `taskLoop.agents.enabled = false` by default and let the main turn do
everything.

- **Pros**: eliminates duplication and stale child evidence by construction.
- **Cons**: removes the multi-role pipeline that is the product feature; does not
  fix the hang, permission, or dashboard issues. A configuration regression is
  not a runtime fix.
- **Verdict**: rejected. The loop must be hardened, not disabled.

### Chosen: full lifecycle hardening (R1-R7)

Address each finding at its boundary: session lifecycle (R1), completion and
turn scheduling (R2), tool bounds and path resolution (R3), main-turn/agent
coordination (R4), permission preflight (R5), dashboard disposition (R6), and
documented decision precedence (R7). Each requirement has an independent
regression test, so the change can land incrementally.

### Dashboard sub-decision: wire vs remove

- **Wire it**: keep `startWebDashboard`, mount it behind an explicit config flag,
  document that it is read-only, and add a caller.
- **Remove it**: delete the module and its tests.
- **Chosen**: wire it behind an explicit opt-in flag (default off) *or* remove
  it if wiring would expose an unauthenticated surface. Either outcome MUST
  leave zero dead exports. Prefer **remove** if no consumer appears during
  implementation; the requirement is stated as an exclusive choice.

## 4. Requirement mapping

| ID | Finding | Design decision |
|----|---------|-----------------|
| R1 | 1 | Init WAM state on `session.created`; clean up on `session.deleted`. If first-message init is retained, document it explicitly in the contract. |
| R2 | 4, 5 | Completion transition MUST cancel pending child work and stop scheduling turns; the session MUST become idle. |
| R3 | 4 | Every child tool call gets an `AbortSignal` timeout; relative paths resolve against `projectRoot`; absolute paths outside it are rejected. |
| R4 | 3 | Agents snapshot state after the main turn's mutations, or mark pre-turn evidence `stale` and refuse to act on it. |
| R5 | 2 | Non-advisory mode: `pending` permission blocks mutating tools. Advisory mode unchanged. |
| R6 | 6 | Wire `startWebDashboard` behind a flag with a documented read-only contract, or delete it. No dead export. |
| R7 | 7 | Document that `STOP_STAGNATION` is evaluated before `VERIFY`, bounding verification loops; verify still runs when progress is detected. |

## 5. Risks and mitigations

- **False aborts from R3 timeouts**: make the timeout configurable and log the
  aborted call with its target path.
- **R5 blocking legitimate writes**: only non-advisory mode changes; advisory
  behavior is frozen and covered by a regression test.
- **R1 double init**: make initialization idempotent and keyed by session id.
- **R2 orphaned children**: cancellation MUST await child settlement before the
  session is marked idle.
- **R7 behavior drift**: encode the precedence in a test rather than relying on
  the uncommitted reorder.

## 6. Validation

- `node --test --test-force-exit <affected test files>` per requirement.
- `openspec validate --changes --strict`.
- `npm run build` and a `dist/` load-check.
- Live end-to-end run against `opencode serve` 1.19.4 (plugin loaded from
  `dist/index.js`, API + SSE events, real model turns): 15/15 checks covering
  R1 eager init, R2 no post-DONE busy loop, R3 child path rejection, R4 agent
  pass with fresh evidence, and R6 dashboard removal.

### 6.1 Runtime findings fixed during live validation

- **Gate ownership**: activating `executionGate` at the start of `chat.message`
  blocked the main model's own `write` calls for the whole turn (observed as a
  30-message loop). The gate now belongs to the idle agent pass
  (`runTaskAgentPass` → `taskWithGate`), which is the only writer allowed
  during agent execution; `chat.message` only clears stale gates.
- **Idle dispatch race**: `session.idle` can arrive before the prompt RPC that
  produced it resolves, so `autoContinueInFlight` and the task driver's
  `in-flight` guard are still set and the event was silently dropped, leaving
  the task in `IMPLEMENTING` with no agent pass. `dispatchIdle` now waits for
  `autoContinueInFlight` to clear and retries `maybeTaskLoop` while the driver
  reports `in-flight`.
- **DONE vs in-flight pass**: when a task reaches `DONE` while an agent pass is
  running, the R2 guard settles (and aborts) child work instead of leaving it
  orphaned; the pass is skipped because no work remains.
