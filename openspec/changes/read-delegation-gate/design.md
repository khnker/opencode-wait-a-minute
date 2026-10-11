# Design: Read Delegation Gate

## Context

`governance-enforcement.js` intercepts every `tool.execute.before`. The main session and
subagents share the same hook; the only signal distinguishing them is the WAM
`sessionParents` Map. A previous attempt read `isSubagent` from inside the governance `try`
block (block scope), so the gate could never see it (ReferenceError swallowed by the outer
catch) and never fired.

## Decision

- Compute `const isSubagent = sessionParents.has(sid)` once at function scope, before the
  governance `try`, so both governance and the read-delegation gate share it.
- Add `DELEGATION_GATED_TOOLS = new Set(['read', 'grep', 'glob', 'list'])` and
  `enforceReadDelegation({ mode, isSubagent })` in `governance-enforcement.js`.
- Three modes: `off` (no-op), `warn` (log only, default), `enforce` (throw
  `WamPolicyBlock`). Message instructs to re-dispatch via `Task(subagent_type="fast")`.
- Gate applies only when `!isSubagent`; subagents are never gated (avoids recursion).

## Alternatives rejected

- **Model inheritance (PoC B)**: does not fix *who* runs searches; orthogonal portability
  concern. Rejected as the fix.
- **`opencode-model-router` enforcement**: subagent-only
  (`if (!sid || !sessionStore.isSubagent(sid)) return`), cannot gate the orchestrator.

## Risks

- False positives on legitimate 1-call inline reads → mitigated by `warn` default.
- Fail-open: any error in the gate must not break the tool call.
