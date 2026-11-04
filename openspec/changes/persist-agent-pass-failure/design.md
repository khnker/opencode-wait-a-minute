# Design — persist failed agent passes

## Research

- Node.js error propagation in async code: a caught error must cross the trust boundary
  as state, not only as a log line (https://nodejs.org/api/errors.html).
- OpenCode plugin hooks run inside a long-lived server; an unpersisted catch is lost on
  the next turn (https://opencode.ai/docs/plugins/).
- Repo rule in `AGENTS.md`: "fail loud on corrupt state, fail soft on diagnostics".
  Retrying a deterministically failing pass forever is neither.
- Prior change `recover-terminal-agent-pauses` already models terminal agent states
  (`BLOCKED`, `NEEDS_INPUT`, `FAILED`), surfaces them once, and reopens on a real turn.
  This change feeds the failure into that model instead of duplicating it.

## Alternatives

1. **Keep swallowing and retry (status quo).** Rejected: silent infinite loop, no user
   signal, and it hides the adapter/timeout error that caused the failure.
2. **Retry counter with backoff.** Rejected: adds state and still hides the cause; a
   deterministic error burns budget before surfacing.
3. **Persist `FAILED` + `failureReason`, surface once, stop retries (chosen).** Reuses
   the existing terminal-state and surfacing machinery, is observable, and the next
   real user turn reopens the run.

## Decision

`applyAgentFailure` is a thin wrapper over `applyAgentRun` so history capping, timestamps
and immutability stay in one place. The failure message is stored on `agentRun` and
propagated through `agentSignalForLoop`; `decideAgentLoopAction` turns a `FAILED`
signal into `BLOCK` with `agent-failed: <detail>` (truncated to 200 chars).

The catch path re-reads the task before persisting so it does not clobber a concurrent
update, and falls back to returning `agent: null` if persistence itself fails.

## Risks

- If the adapter throws for a transient reason, the loop now pauses instead of retrying.
  The pause text includes the cause and a user reply reopens it, which is the intended
  trade-off (visible failure over silent spin).
- `applyAgentFailure` appends a history entry; `maxHistory` keeps it bounded.
