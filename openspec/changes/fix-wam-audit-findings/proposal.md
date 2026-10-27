# Proposal: Fix Wait-a-Minute Plugin Audit Findings

## Why
This change addresses six critical audit findings identified in the wait-a-minute plugin codebase. These findings represent security and reliability vulnerabilities that could compromise task verification, state persistence, and runtime behavior.

## What Changes
1. **F1 HIGH verified-evidence bypass**: Fix pending requirement logic to require evidence for both "done" and "verified" statuses
2. **F2 HIGH completion detection depends on prompt text**: Remove early return dependency on prompt text for completion detection
3. **F3 HIGH non-atomic persistence + silent corruption**: Implement atomic writes and fail-loud parsing for task state persistence
4. **F4 MEDIUM no tests for `/wam off` / `/wam on` session bypass**: Add comprehensive tests for all three enforcement points
5. **F5 MEDIUM migration runner is a no-op**: Implement actual migration runner with version ordering
6. **F6 LOW contract approval prompt fires for trivial/conversational messages**: Gate contract prompt on non-trivial analysis

## Detailed Findings

### F1 HIGH verified-evidence bypass
- **Location**: `src/integration/orchestration.js` ~L167-186
- **Issue**: Pending requirement logic only requires evidence when `status==="done"`, not for "verified"
- **Root Cause**: `confirmCompletion` in `src/verification/verification-policy.js` ~L130-136 calls `evaluateCompletionGate(task)` without `promptText`, causing early return with `blocked:false`
- **Risk**: Tasks can be marked verified without required evidence, bypassing audit trails

### F2 HIGH completion detection depends on prompt text
- **Location**: `src/integration/orchestration.js` ~L45-50, L138
- **Issue**: `evaluateCompletionGate` early-returns unless `isCompletionIntent(promptText)` matches
- **Risk**: Completion detection fails based on natural language phrasing rather than actual task completion state

### F3 HIGH non-atomic persistence + silent corruption
- **Location**: `src/state/task-state-file.js`
- **Issues**:
  - `saveTaskState` (~L98) writes final path directly without atomic operation
  - `loadTaskState` (~L39-45) swallows parse errors into `{}`
  - Unknown per-task status skipped (~L70-72)
  - `reconcileFromDisk` (~L111) load→save without lock
- **Risk**: File corruption during writes, silent data loss, inconsistent state recovery

### F4 MEDIUM no tests for `/wam off` / `/wam on` session bypass
- **Location**: `src/integration/message-handler.js:194`, `index.js:913` postToolExecution, `index.js:1090` tool.execute.before
- **Issue**: No test coverage for the three enforcement points that handle `/wam off` and `/wam on` commands
- **Risk**: Session bypass functionality could break without detection

### F5 MEDIUM migration runner is a no-op
- **Location**: `src/persistence/migration-runner.js` L1-16
- **Issue**: Never calls `m.up()`/`m.apply()`; unknown statuses dropped silently
- **Risk**: Database migrations never execute, schema updates never applied

### F6 LOW contract approval prompt fires for trivial/conversational messages
- **Location**: `src/integration/message-handler.js` ~L562
- **Issue**: Contract approval prompt triggers for trivial/conversational messages
- **Risk**: User friction for routine interactions, reduced usability