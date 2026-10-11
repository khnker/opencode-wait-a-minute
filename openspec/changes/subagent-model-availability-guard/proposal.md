# Proposal: Subagent Model Availability Guard

## Why
Subagent delegation is the most fragile operation in the agent loop. Analysis of `opencode.db` (4,852 sessions / 174,202 tool calls) shows the `task` tool made 4,064 calls and **1,445 failed (35.6%)**. Of those failures, **977 (67%) were `Model not found`** — one tier pointing at a provider model that no longer exists (`anthropic/claude-haiku-4-5`: 666; `litellm/polar-fast`: 137; `anthropic/claude-sonnet-4-6`: 79; `omni/agent`: 59; `litellm/polar-medium`: 36), across **177 sessions**. A further 100 failures were `Subagent depth limit reached (1)`, 30 were strategy violations, and 29 were schema-invalid arguments. Each failed delegation either aborts the intended fan-out or silently collapses the work back into the orchestrator, ballooning context and cost. Raw provider errors must never surface from WAM.

## What Changes
- Introduce `src/skills/subagent-model-availability.js`: resolves the requested tier's model against the configured router/preset registry **before** dispatch.
- Deterministic, bounded fallback to the next available tier/provider when the requested model is unavailable.
- When no tier resolves, refuse dispatch with an actionable reason and mark the action `blocked`/`skipped` instead of emitting a raw provider error.
- Depth-limit aware dispatch: decompose or refuse before hitting `subagent depth` limit.
- Record the resolution decision as evidence (chosen tier, fallback hops, reason).

## Capabilities
### New Capabilities
- `subagent-model-availability`: pre-dispatch model resolution, bounded fallback, actionable refusal, and depth-limit awareness for subagent dispatch.

## Impact
- `src/skills/subagent-execution.js` (pre-dispatch validation)
- `src/execution/execution-engine.js:120` and `src/execution/runtime-guards.js:31` (guard gate)
- New tests `src/skills/subagent-model-availability.test.mjs`
- Target: eliminate the 977 `Model not found` failures and the silent inline collapse they cause.
