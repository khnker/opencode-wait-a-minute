# Design: Task Control and Friction Mitigation

## Components
- **Task State Validator**: Enforces strict transitions between PROPOSED, IMPLEMENTING, VERIFYING, and DONE.
- **Drift Guard**: Detects repeated user commands or frustration signals and resets stale execution contexts.
