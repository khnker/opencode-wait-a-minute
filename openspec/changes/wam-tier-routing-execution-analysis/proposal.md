# Change: WAM tier routing for execution vs analysis agents

## Objective
Route WAM subagent dispatches by role: execution agents (`backend-exec`,
`frontend-exec`, `debugger`) to the `fast` tier, analysis agents (`planner`,
`arch-review`) to the `medium` tier.

## Why
The canonical `SUBAGENT_TIER_MAP` sent every worker to `medium`, so the
orchestrator paid medium-tier cost for mechanical execution. The router now
exposes `omni/fastllm` (free Gemini) and `omni/mediumllm`
(deepseek-v4.1-flash); WAM must resolve each subagent type against the tier
that matches its work.

## Non-goals
- Does not change `fast`/`medium`/`heavy` primary tiers themselves.
- Does not add a configuration surface: the map stays a frozen constant.
- Does not alter escalation (`escalateTier` still walks fast → medium → heavy).
