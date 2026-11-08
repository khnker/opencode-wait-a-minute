# Change: Harden Autonomous Loop Runtime

## Objective

Make the WAM autonomous execution loop bounded, observable, and safe to drive
from a headless `opencode serve` session. The change closes the gaps found while
driving a real session with curl: late state initialization, duplicated
main-turn/agent work, unbounded child tool calls, stale ANALYST evidence, a loop
that reports `COMPLETED` while the session stays `busy`, an advisory permission
preflight that does not block writes, an orphaned dashboard export, and an
undocumented `STOP_STAGNATION`/`VERIFY` precedence.

## Why

Empirical findings from a real `opencode serve` session:

1. `POST /session` does not initialize WAM state; `.wam/` and task state only
   appear on the first message. `session.created` is never used to init state.
2. On the first message the contract is auto-approved under the 0-friction U1
   policy while `permissionPreflight.edit` stays `pending`; writes proceed
   anyway.
3. `src/execution/task-agent-run.js` ran ANALYST -> ARCHITECT -> BUILDER ->
   REVIEWER in child sessions while the main model turn also ran its own
   write/bash tools. Work was duplicated and ANALYST reported `saludo.txt does
   not exist` while BUILDER then created it (stale/racing evidence).
4. After the task reached `phase: DONE`, `loop-state.json` recorded `COMPLETED`,
   `iteration: 0`, `lastDecision: COMPLETE`, but the parent session stayed
   `busy` for minutes because its last tool call
   `glob {pattern:"*", path:"/home/nicolas/dev/wait-a-minute-plugin"}` remained
   `running`. `POST /session/<id>/abort` cleared it. The glob targeted the
   plugin repo, not the session `projectRoot`.
5. The synchronous `POST /session/{id}/message` never returned (>90s, 0 bytes)
   because the session never went idle.
6. `src/integration/web-dashboard.js` exports `startWebDashboard` but has no
   callers; its routes are GET-only (`/api/sessions`, `/api/session`) and it
   cannot create sessions via curl.
7. An uncommitted change in `src/execution/task-loop.js` (~lines 150-160) moved
   `STOP_STAGNATION` before `VERIFY` without documenting the precedence.

Each finding maps to a requirement (R1-R7) in the delta spec. Without these
fixes the loop can hang forever, double-write the workspace, reason over stale
state, and silently ignore a pending permission.

## Scope

- Delta capability: `autonomous-execution-loop` (R1-R7).
- Session lifecycle hooks: `session.created` / `session.deleted` wiring.
- Loop-completion and turn-scheduling guards.
- Child tool-call timeout plus `projectRoot`-relative path resolution.
- Main-turn/agent coordination and stale-evidence marking.
- Non-advisory permission preflight enforcement.
- Dashboard wiring or removal; no dead export.
- Documented `STOP_STAGNATION` vs `VERIFY` precedence.

## Non-goals

- Implementing the changes in this change set. This proposal only authors the
  spec, design, and task list.
- Redesigning the 0-friction U1 policy or the risk envelope
  (`openspec/changes/action-risk-envelope/`).
- Changing the public HTTP contract of `opencode serve`.
- Adding authentication, TLS, or multi-tenant isolation to the dashboard.
- Rewriting the ANALYST/ARCHITECT/BUILDER/REVIEWER role prompts.

## Impact

- **Runtime**: `src/execution/task-loop.js`, `src/execution/task-agent-run.js`,
  session lifecycle wiring in `index.js`, permission preflight.
- **Integration**: `src/integration/web-dashboard.js` (wire or remove).
- **Behavior**: sessions become idle after completion; pending edits block writes
  outside advisory mode; child tools cannot escape `projectRoot`.
- **Risk**: medium. Touches the autonomous loop and permission gating; the
  bounded-timeout and lifecycle guards are the highest-risk areas.
- **Tests**: new regression tests per requirement under `tests/` and
  `src/**/*.test.js`.
