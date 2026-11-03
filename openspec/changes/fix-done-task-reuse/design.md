# Design — DONE task reuse

## Research

- Node.js test runner docs (regression tests with `node --test`):
  https://nodejs.org/api/test.html
- OpenSpec change workflow (specs, design, tasks):
  https://github.com/Fission-AI/OpenSpec
- WAM continuation/auto-loop contract: `index.js` `isContinuationPrompt` and
  `src/execution/task-agent-run.js` `shouldRunTaskAgentPass`.

## Alternatives

1. **Per-caller phase check** — add an `isTaskDone` check at each
   `effectiveTaskId` call site.
   Rejected: duplicates precedence logic and lets callers diverge.
2. **Centralized guard in `effectiveTaskId`** — inject an `isTaskDone`
   predicate, skip cached/active `DONE` ids only for new instructions, and
   derive a fresh id through all fallback namespaces.
   Chosen: single chokepoint, deterministic, testable without state I/O, and
   keeps continuation behavior by construction.

## Decisions

- **D1:** Gate the skip on `!isContinuationPrompt(promptText)` so explicit
  continuations and `WAM`-prefixed auto-loop prompts keep binding to the
  existing task.
- **D2:** `freshDerived` appends `-2`, `-3`, ... when the derived id collides
  with the skipped `DONE` task, guaranteeing a new task id even in the
  session/default namespaces.
- **D3:** The regression test asserts both a changed `taskId` and
  `shouldRunTaskAgentPass(nextState) === true`, covering the user-visible bug
  and its downstream consequence.
