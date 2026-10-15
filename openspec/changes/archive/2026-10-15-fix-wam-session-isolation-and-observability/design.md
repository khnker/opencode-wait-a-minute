# Design: Fix WAM Session Isolation and Observability

## Architecture
- **Task Identity**: `effectiveTaskId` and task resolution will require explicit session binding and project roots, disallowing slug-only sharing across distinct sessions.
- **Session State**: Scoping `sessionStore` and `sessionTasks` maps per session ID, with explicit per-session active task tracking.
- **Snapshot Validation**: `checkContinuation()` and snapshot validation checks will verify `projectRoot`, `taskId`, and `sessionId` match the current execution context before accepting fast-path recovery.
- **Observability**: `emitTextPart()` will return structured status objects (`{ status: "inserted" | "unsupported-output-shape" | "error", details?: string }`), logged via `wamLog` / `console`.
