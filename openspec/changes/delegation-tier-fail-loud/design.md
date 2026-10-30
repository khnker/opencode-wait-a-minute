# Design: Fail loud on unknown subagent types

## Invariant

Dispatch is always allowed (zero friction). An unrecognised `subagent_type` still resolves
to the `"medium"` tier, but the guard result carries `unknownSubagentType: true` and a
`recommendation` naming the type and the defaulted tier.

## Alternatives considered

### A. Reject unknown types (`allowed: false`) (rejected)

Breaks the `zero-friction-advisory` invariant: a typo would stop the orchestrator instead
of informing it, and the human would be asked to fix agent configuration mid-task.

### B. Log-only warning (rejected)

`console.error` from a guard is invisible to the orchestrator, which is the only consumer
that can fix the `subagent_type`. The signal has to ride on the object already returned.

### C. Structured flag on the advisory result (chosen)

Backwards compatible (`tierForSubagentType` keeps returning a string), no new
configuration knob, no new module, and the signal lands on the same object the orchestrator
already inspects for `escalated` / `nudge`.

## Notes

- `unknown: true` is a diagnostic, not a gate: `resolveSubagentTier("wizard").tier` is
  still `"medium"` and dispatch proceeds.
- `null` / `undefined` means "no type provided" and stays on the default path with
  `unknown: false`; an empty string resolves as an unknown type.
- `runtime-guards.js` returns the guard result when it carries a `recommendation` — the
  same early-return shape escalation already uses — so the advisory reaches the caller.

## Risks

- A trailing recommendation on the guard result could be mistaken for a block. Mitigation:
  it travels next to `allowed: true` and never replaces it; the escalation path still wins
  the return for escalated dispatches.

## References

- `src/skills/subagent-model-availability.js`
- `src/skills/subagent-model-availability.test.mjs`
- `src/execution/runtime-guards.js`
- `openspec/changes/zero-friction-advisory/design.md`
- `AGENTS.md`
