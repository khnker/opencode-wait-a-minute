# Design — start the agent loop early

## Research

- OpenCode plugin lifecycle: hooks are `chat.message` (runs before the assistant
  turn) and `session.idle` (runs after a turn finishes). `chat.message` is the
  only place where WAM can start work before the main session edits files.
  https://opencode.ai/docs/plugins/
- Existing WAM contract: the agent runtime is optional (`agents.enabled`), roles
  are isolated, and only `BUILDER` may modify code. This change reuses that
  contract instead of adding a second execution path.

## Alternatives

1. **Start everything on `session.idle` (current behavior).**
   Rejected: main sessions that keep working never become idle, so the loop
   never starts.
2. **Await the full agent pass inside `chat.message`.**
   Rejected: the hook would block the first assistant turn for the whole
   pipeline and risks provider/hook timeouts.
3. **Start the pass asynchronously and gate mutations (chosen).**
   `chat.message` classifies the task, sets a persisted `executionGate`, and
   starts the pass without awaiting it. `tool.execute.before` blocks mutating
   tools while the gate is active. The pass clears the gate in `finally`.
4. **Only gate the main session and not subagents.**
   Chosen: worker sessions must keep writing because they execute the approved
   plan delegated by the main session.

## Decisions

- Intent is classified from the prompt: explicit analysis directives before an
  implementation verb → `ANALYZE`; otherwise a non-trivial task → `IMPLEMENT`;
  trivial edits → `INLINE`.
- `ANALYZE` uses `ANALYST → ARCHITECT → REVIEWER`; a non-accepted review stops
  with `exhausted: true` so the fallback does not rerun it forever.
- `INLINE` keeps the current behavior: no gate and no agent pass.
- The gate only blocks mutations (`write`, `edit`, `patch`, and mutating shell
  commands). Reads, searches, and read-only git commands remain available.
- `buildPersistedState` normalizes an approved contract to `IMPLEMENTING` when
  the persisted phase is still `PROPOSED`.

## Risks

- A very fast agent pass may finish before the main session issues its first
  edit; the gate then has no effect on that turn. This is acceptable because the
  main should have received the agent results.
- Shell mutation detection is heuristic. Native edit tools are the primary
  target; the shell regex covers common destructive commands.
- `session.idle` remains a fallback, so a completed early pass is not rerun
  because `shouldRunTaskAgentPass` returns false for accepted/exhausted runs.
