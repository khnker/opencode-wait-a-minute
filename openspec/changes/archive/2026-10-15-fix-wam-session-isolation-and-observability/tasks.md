## 1. Task Identity & Isolation
- [x] 1.1 Centralize session task resolution with strict session binding
- [x] 1.2 Prevent cross-session task state sharing on slug collision

## 2. Snapshot Ownership Validation
- [x] 2.1 Enforce projectRoot, taskId, and sessionId check in snapshot continuation validation
- [x] 2.2 Invalidate fast-path if ownership mismatch occurs

## 3. Hook Observability
- [x] 3.1 Refactor emitTextPart to return explicit status and log insertion outcome
- [x] 3.2 Add diagnostic tracing for chat.message execution

## 4. Testing & Verification
- [x] 4.1 Add concurrent session isolation unit tests
- [x] 4.2 Run test suite and verify all checks pass
