# Design — close the task loop after an accepted agent run

## Research

- OpenCode plugin lifecycle hooks used by WAM (`chat.message`,
  `session.idle`, `tool.execute.before`):
  https://opencode.ai/docs/plugins/
- Node.js built-in test runner for the regression tests:
  https://nodejs.org/api/test.html
- Code audit of `src/execution/task-agent-run.js`,
  `src/execution/task-loop.js`, `src/integration/orchestration.js` and the
  Playwright run artifacts under
  `/home/nicolas/wam-playwright-dummy/.wam/tasks/`.

## Alternatives

1. **Mark requirements only `done` on reviewer `ACCEPTED`.**
   Rejected after replaying the live task: the Completion Gate requires
   `verified` and maps only verified evidence to the outcome contract, so the
   task still never closes.
2. **Only fix the `VERIFY` / stagnation precedence.**
   Rejected: the loop would stop, but the task would still never close because
   the requirement would remain `pending` with no evidence.
3. **Ask the main session to mark the requirement manually.**
   Rejected: the main session has no tool or slash command for that transition;
   the live run showed it reading WAM source instead.
4. **Treat the reviewer's `ACCEPTED` verdict as requirement verification, and
   make stagnation win over verification (chosen).**
   The reviewer is the pipeline's verification role; its evidence is recorded on
   each non-verified requirement. The Completion Gate still evaluates contract
   checks and the outcome contract, so it remains the authority on completion.
5. **Let the main session persist `DONE` after reading the completed loop.**
   Rejected by the live run: the main session was blocked, inspecting WAM source,
   and never wrote the transition. The loop driver owns the `COMPLETE` decision,
   so it persists `DONE` under the same lock.

## Decisions

- Evidence comes from the summarized `REVIEWER` result: summary, evidence, and
  artifacts. It is appended to each non-verified requirement as a single string.
- Only `COMPLETED` + `ACCEPTED` runs mutate requirements. Failed, blocked, and
  revision-required runs leave requirements untouched.
- Accepted `ANALYZE` runs do not mutate requirements because analysis does not
  implement them.
- Requirements already `verified` are left unchanged; `pending` and `done`
  requirements become `verified` with `verifiedAt`.
- The Completion Gate still evaluates contract checks, verification checks, and
  the outcome contract after requirements become `verified`.
- `decideNextAction` treats the gate success shape `{ blocked: false, allDone:
  true }` as complete, not only `pending: []`. Without this, an accepted run
  re-entered `VERIFY` forever even though the gate had passed.
- `decideNextAction` checks the no-progress guard before `verification-required`
  so `STOP_STAGNATION` is reachable with pending work.
- When the decision is `COMPLETE`, `driveTaskLoop` persists the task as `DONE`
  with `nextAction: "Tarea completa — contrato verificado"` before releasing the
  loop lock, so the persisted task cannot contradict the closed loop.

## Risks

- A reviewer that accepts without covering every requirement could verify too
  much. Mitigated by the Completion Gate, which still evaluates contract checks
  and the outcome contract; a future change can map evidence per requirement.
- Reviewer evidence is plain text, consistent with the existing requirement
  evidence format.
