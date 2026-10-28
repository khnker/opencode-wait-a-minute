# Design: Permission Preflight Before Delegation

## Context

OpenCode exposes a `permission.ask` hook per tool call. WAM's `tool.execute.before`
runs for both the main session and subagents and already distinguishes them with
`sessionParents.has(sid)`. Task state is the durable source of truth and is
re-read from disk on each hook, so a plan stored there survives restarts and is
visible to the `permission.ask` hook.

## Decision

- Derive the plan deterministically from task text (objective, requirement
  titles, verification) plus the incoming delegation description. No LLM.
- Rules are additive and deduped, emitted in a fixed order
  (`edit`, `bash`, `webfetch`, `external_directory`) so persisted plans and
  tests are stable.
- `ensurePermissionPlan` only creates a plan when the contract is `APPROVED`
  and never overwrites an existing plan, preserving `granted`/`denied`.
- The main session is blocked from calling `task` while the plan is pending or
  denied (`WamPolicyBlock`, level `high`). Subagents are never blocked.
- `permission.ask` flips `output.status` to `allow` only when the plan is
  granted and the requested type is in `granted`; everything else stays `ask`.
- The plan is injected into the message context as a visible notice so the user
  can approve before delegation, and is also available via
  `/wam permissions approve|deny`.

## Research

- OpenCode plugin hooks: `permission.ask` receives `{ type, pattern }` and
  mutates `output.status` (`ask` | `allow` | `deny`).
- OpenCode tool hook `tool.execute.before` may mutate `input.output` and throw
  to block; WAM wraps blocks in `WamPolicyBlock`.
- OWASP ASVS V4 access control: request the full access surface up front and
  keep decisions least-privilege and explicit.

## Alternatives considered

1. **Prompt per permission at first use (status quo)** — rejected: the prompt
   arrives mid-delegation, after the dispatch cost is paid, and the user cannot
   see the whole access surface at once.
2. **Blanket allow all permissions once the contract is approved** — rejected:
   it grants `bash`, `webfetch` and `external_directory` even when the task does
   not need them, violating least privilege.
3. **LLM-inferred permission plan** — rejected: non-deterministic, adds latency
   and a required model dependency for a security decision. Chosen approach is
   regex + contract state, fully testable offline.
