# Proposal: Fail loud on unknown subagent types

## Why

`tierForSubagentType()` silently mapped any unrecognised `subagent_type` to `"medium"` in
`src/skills/subagent-model-availability.js`. Dispatch staying allowed is correct, but the
orchestrator could not tell a deliberate medium subagent from a typo'd type
(`subagent_type: "wizzard"`). `AGENTS.md` asks for the opposite trade-off: "fail loud on
corrupt state, fail soft on diagnostics" — an unrecognised type is corrupt input and was
being swallowed.

## What changes

- `resolveSubagentTier(subagentType)` returns `{ tier, unknown }`; `tierForSubagentType()`
  delegates to it, so existing callers and tests keep their string contract.
- `guardSubagentDispatch()` adds `unknownSubagentType: true` and a `recommendation` naming
  the offending type and the defaulted tier. `allowed` stays `true`; nothing throws.
- `src/execution/runtime-guards.js` propagates that `recommendation` from the guard result
  instead of dropping it. Escalation and nudge behaviour unchanged.

## Out of scope

- Blocking, rejecting or throwing on an unknown type.
- Changing `TIER_LADDER`, `escalateTier()` or `demoteTier()` semantics.
- Model registry loading (`loadModelRegistry`) and model fallback chains.

## Research

In-repo sources read for this change:

- `AGENTS.md` design rules — "Validate at trust boundaries; fail loud on corrupt state,
  fail soft on diagnostics."
- `openspec/changes/zero-friction-advisory/proposal.md` — advisory results never block.
- `src/skills/subagent-model-availability.js` and `src/skills/subagent-model-availability.test.mjs`.
- `src/execution/runtime-guards.js` — delegation guard hand-off and escalation nudge.
