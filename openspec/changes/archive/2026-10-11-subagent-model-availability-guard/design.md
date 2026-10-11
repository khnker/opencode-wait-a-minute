# Design: Subagent Model Availability Guard

## Context
Analysis of 174,202 tool calls revealed that 35.6% of `task` tool calls failed, with "Model not found" accounting for a significant portion (977 errors across 177 sessions). Failed delegation often collapses into silent inline execution or redundant retries, causing context blowup.

## Goals / Non-Goals
- **Goals**: Implement pre-dispatch model validation, deterministic fallback, depth-limit awareness, and record resolution decisions.
- **Non-Goals**: Changing the underlying model routing infrastructure, full refactor of subagent execution.

## Decisions
- Resolver module implemented in `src/skills/subagent-model-availability.js` leveraging router/preset config.
- Validation logic integrated into `src/skills/subagent-execution.js` and `src/execution/execution-engine.js:120`.

## Risks / Trade-offs
- Risk: Potential for false negatives if the registry is slightly out-of-sync with provider availability. Mitigation: Deterministic fallback and detailed logging of resolution.

## Migration Plan
1. Implement resolver module.
2. Wire validation into existing pre-dispatch hooks.
3. Add unit tests for available / fallback / none / depth-limit scenarios.
