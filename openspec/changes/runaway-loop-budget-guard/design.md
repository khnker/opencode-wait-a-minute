## Context
Agents currently lack limits on repeated identical actions.

## Goals / Non-Goals
- Goal: Enforce budget/repetition limits.
- Non-Goal: Block legitimate progress (allow resets on state changes).

## Decisions
- Normalize (tool, input) for repetition tracking.
- Force STOP/ESCALATE on budget exceed.

## Risks / Trade-offs
- Risk: Too aggressive blocking of valid loops.
- Trade-off: Development friction vs cost control.

## Migration Plan
1. Implement tracker/guard module.
2. Integrate into execution-engine.
3. Test repeat detection and state-change resets.
