# Change: Read Delegation Gate

## Objective

Prevent the main session (orchestrator) from executing read-only exploration tools
(`read`, `grep`, `glob`, `list`) inline, forcing it to delegate that work to the `@fast`
subagent instead. Rationale: information-gathering is execution and dominates the
orchestrator's tool-call budget and context cost; delegating it is ~20x cheaper.

The gate is **model-agnostic**: it keys purely on main-vs-subagent session identity
(`sessionParents.has(sid)`), never on a model id, so it stays portable across users with
different model configurations. It defaults to `warn` (non-breaking) and can be escalated
to `enforce`.
