# Proposal: Fix WAM Session Isolation, Task Identity Contract, and Hook Observability

## Why
Cross-session state contamination and silent message injection failures can cause agents in distinct sessions to inherit state from each other or fail to inject WAM control headers correctly.

## What Changes
1. **Task Identity Contract**: Strict session binding to eliminate cross-session collision.
2. **Session State Isolation**: Isolate `sessionStore` and task active records per session ID.
3. **Snapshot Ownership Validation**: Validate projectRoot and taskId ownership before continuation fast-path reuse.
4. **Hook Observability**: Refactor `emitTextPart` to return explicit insertion status and log diagnostics.
