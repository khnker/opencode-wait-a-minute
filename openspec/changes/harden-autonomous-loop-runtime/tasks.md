# Tasks: Harden Autonomous Loop Runtime

## R1 — Session lifecycle

- [x] 1.1 Wire WAM state initialization to the `session.created` hook in `index.js`; make it idempotent per session id.
- [x] 1.2 Wire state cleanup to the `session.deleted` hook (remove task/loop state, close handles).
- [x] 1.3 If first-message initialization is retained, document it explicitly in the session contract and add a test that asserts the chosen behavior.
- [x] 1.4 Add regression tests: state exists after `session.created`; state is removed after `session.deleted`; double-create does not duplicate state.

## R2 — Loop completion

- [x] 2.1 Ensure that when task phase is DONE/verified the loop stops scheduling turns (`src/execution/task-loop.js`).
- [x] 2.2 Cancel and await pending child agents on completion so the parent session becomes idle.
- [x] 2.3 Ensure `loop-state.json` terminal state (`COMPLETED`, `lastDecision: COMPLETE`) is consistent with an idle session.
- [x] 2.4 Add regression tests: completed loop leaves no scheduled turn; session reaches idle; no child agent remains running.

## R3 — Tool execution bounds

- [x] 3.1 Apply an `AbortSignal.timeout(ms)` (configurable) to every WAM child/subagent tool call.
- [x] 3.2 Resolve relative tool paths against the session `projectRoot`.
- [x] 3.3 Reject absolute paths outside `projectRoot` (e.g. the plugin repo) instead of executing them.
- [x] 3.4 Log aborted and rejected calls with the offending path.
- [x] 3.5 Add regression tests: a hanging tool is aborted at the timeout; `glob *` resolves under `projectRoot`; an absolute plugin-repo path is rejected.

## R4 — Agent/main-turn coordination

- [x] 4.1 Snapshot task state for ANALYST only after the main turn's mutations settle, or mark pre-turn evidence as `stale`.
- [x] 4.2 Make agents refuse to act on `stale` evidence (no BUILDER mutation derived from it).
- [x] 4.3 Prevent the main turn and child agents from applying the same mutation (dedupe or explicit ownership).
- [x] 4.4 Add regression tests: ANALYST sees a file created by the main turn; pre-turn evidence is marked stale; duplicate writes do not occur.

## R5 — Permission preflight

- [x] 5.1 In non-advisory mode, block mutating tools while `permissionPreflight.edit` is `pending`.
- [x] 5.2 Preserve advisory-mode behavior unchanged.
- [x] 5.3 Add regression tests: non-advisory `pending` blocks write; approved write proceeds; advisory `pending` does not block.

## R6 — Dashboard

- [x] 6.1 Decide wire-or-remove for `startWebDashboard` (`src/integration/web-dashboard.js`): wire it behind an opt-in flag, or delete the module.
- [x] 6.2 If wired, document the read-only contract for `GET /api/sessions` (~line 15) and `GET /api/session` (~line 67), and add the caller.
- [x] 6.3 If removed, delete the export and its tests; leave no dead export either way.
- [x] 6.4 Add a regression test asserting there is no uncalled export (or that the flag defaults off).

## R7 — Stagnation vs verification ordering

- [x] 7.1 Document in `src/execution/task-loop.js` (near lines 150-160) that `STOP_STAGNATION` is evaluated before `VERIFY` and why (bound verification loops without prematurely stopping tasks whose progress detection failed).
- [x] 7.2 Add a regression test pinning the precedence: stagnation detected -> stop before verify; progress detected -> verify still runs.

## Final validation

- [x] 8.1 Run the affected suites with `node --test --test-force-exit <files>`.
- [x] 8.2 Run `openspec validate --changes --strict` and record the output.
- [x] 8.3 Run `npm run build` and load-check `dist/`.
- [x] 8.4 Run the live e2e harness against `opencode serve` (API + SSE) and record 15/15 checks.
