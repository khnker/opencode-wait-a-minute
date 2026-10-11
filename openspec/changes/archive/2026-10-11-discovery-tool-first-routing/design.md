## Context
High volume of raw bash calls for file discovery and content searching.

## Goals / Non-Goals
- Goal: Route discovery to dedicated tools/MCP.
- Non-Goal: Hard-block all bash; preserve ability to run scripts/complex pipes.

## Decisions
- Nudge over hard-block (configurable enforcement).
- Prefer `workdir` over `cd` for directory context.

## Risks / Trade-offs
- Risk: False positives in classification.
- Trade-off: Nudge friction vs performance gains.

## Migration Plan
1. Implement classifier.
2. Integrate into runtime-guards.
3. Gradual rollout with enforcement off.
