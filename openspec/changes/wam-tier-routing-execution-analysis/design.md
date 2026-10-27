# Design: WAM tier routing for execution vs analysis agents

## Research
- OpenCode subagents and per-agent models: https://opencode.ai/docs/agents/
- OpenCode model resolution/provider config: https://opencode.ai/docs/models/
- Existing canonical tier ladder and dispatch guard:
  `src/skills/subagent-model-availability.js` (this repo).

## Decision
Update the frozen `SUBAGENT_TIER_MAP` constant:

| Subagent type | Tier |
| --- | --- |
| `backend-exec`, `frontend-exec`, `debugger` | `fast` |
| `planner`, `arch-review` | `medium` |
| `fast`, `medium`, `heavy` | same tier |

`tierForSubagentType` is the only resolution point used by
`guardSubagentDispatch`, so this single change drives model selection and the
existing two-failure escalation (fast → medium).

## Alternatives considered
1. **Config-driven map in `.wam/config.json`** — rejected: adds a new config
   surface and trust-boundary validation for a two-line policy that has no
   per-project need today.
2. **Per-agent `subagent_type` rewrite in the orchestrator prompt** — rejected:
   textual instructions are not enforced; the guard would still resolve the
   old tier.
3. **Direct model names in the map** (`omni/fastllm`) — rejected: couples the
   guard to one router preset; tiers keep it provider-agnostic.

## Risks / mitigations
- Escalation base changes: an execution failure now escalates fast → medium
  instead of medium → heavy. Covered by a regression test.
- Unknown subagent types still fall back to `medium` (fail-open).
