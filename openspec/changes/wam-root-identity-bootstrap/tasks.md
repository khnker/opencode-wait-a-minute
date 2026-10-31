# WAM Root Identity & Bootstrap - Tasks

## Implementation Tasks

### 1. Session identity (F1)
- [x] Add `isSessionId(value, root)` to `src/context/context.js`
- [x] Bind `opencode_session_id` only for session-id-shaped values
- [x] Fix the CPC call site to pass the real `sid` and read task state
- [x] Keep `getSessionId` resolving legacy path-shaped state files

### 2. Root resolution (F2)
- [x] Return `sessionRoot` when it owns `.wam`, before the mtime tiebreaker
- [x] Update the tiebreaker comment to describe the ancestor-container case

### 3. Bootstrap (F3)
- [x] Add `isBootstrapRoot` / `applyBootstrapApproval` in `src/context/context.js`
- [x] Apply bootstrap in `buildPersistedState` before persisting
- [x] Keep PROPOSED for every subsequent task and keep `enforcement: true`

## Testing Tasks
- [x] `setActiveSession(root, "/abs/path")` never persists a path
- [x] `resolveWamRoot` prefers a root with its own `.wam` over a fresher sibling
- [x] `resolveWamRoot` still matches a named sibling repo without own `.wam`
- [x] Bootstrap approves the first task and leaves the second PROPOSED

## Validation
- [x] `node --test --test-force-exit tests/unit/root-identity-bootstrap.test.mjs`
- [x] `openspec validate --changes --strict`
- [x] `npm run build`
