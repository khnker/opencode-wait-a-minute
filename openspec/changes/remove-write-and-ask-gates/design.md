# Design: remove-write-and-ask-gates

## Research

- OpenCode plugin hooks: `permission.ask` and `tool.execute.before` are the only
  blocking surfaces a plugin owns; returning `allow` is the supported way to stay out
  of the host's permission path. <https://opencode.ai/docs/plugins/>
- OpenCode permissions are configured by the host
  (<https://opencode.ai/docs/permissions/>); layering a second path/approval policy in a
  plugin duplicates that responsibility and produces inconsistent behavior.
- Predecessor changes in this repo: `zero-friction-advisory` (advisory instead of
  approval), `remove-approval-friction` (auto-grant permission plans) and
  `iterate-agent-friction`. They removed wording and some throws but left the
  execution gate, the path guard and inferred-unknown `ASKING` in place.
- Agent-UX practice: interrupt-driven approval scales with the human; reserve interrupts
  for irreversible effects or genuinely unresolvable requirements.

## Alternatives considered

1. **Keep the gates and add more config toggles.** Rejected: the user asked to remove
   the restriction, not to hide it behind another flag; defaults would still block.
2. **Remove every guard, including destructive-operation checks.** Rejected: hard
   delete / U1 soft-archive violations and corrupt-state validation are safety
   invariants, not workflow approvals, and an existing spec requires them.
3. **Remove WAM workflow gates and rely on opencode's permission layer (chosen).**
   Smallest complete diff, no duplicated policy, and the agent keeps its normal tools.
4. **Keep inferred `ASKING` but auto-answer it.** Rejected: a fake answer pollutes task
   state and evidence; recording the uncertainty as advisory is truthful and
   non-blocking.

## Behavior

- `tool.execute.before` never aborts a write because of WAM workflow state. It may still
  abort on the existing irreversible-operation guard and corrupt-state validation.
- Contract status no longer affects whether a tool runs; `/wam contract approve` remains
  available for visibility but is not required.
- `shouldBlockForPendingPermission` and the `requireApproval` branch are removed; a
  derived permission plan stays informational.
- Unknowns/assumptions default to `advisory`. The message handler only re-enters
  `ASKING` for an unknown that explicitly carries `blocking: true` and no recorded
  decision. A persisted `ASKING` task with no explicit blocker is normalized to
  `IMPLEMENTING` on the next turn.
- Destructive-operation and corrupt-state guards are untouched.

## Risks

- Writes outside the project root are no longer rejected by WAM. This is intentional:
  opencode owns that boundary. Residual risk is documented in the change report.
- A genuine technical ambiguity that the analyzer does not mark `blocking: true` will
  not park the turn; the agent must ask directly instead of relying on WAM.
