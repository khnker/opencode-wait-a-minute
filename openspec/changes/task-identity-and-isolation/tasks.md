# Tasks: Task Identity and Isolation

- [x] Implement `resolveTaskIdentity` in `engine.js` with explicit precedence and session ownership check
- [x] Refactor `runtime/message-handler.js` to use `resolveTaskIdentity` and decouple duplicate detection takeover
- [x] Implement test isolation helper for hermetic `.wam` roots in test suites
- [x] Update `decision-critical-uncertainty.test.mjs` and related test files to use isolated test roots
- [x] Scope loop snapshots to `taskId` + `sessionId` in `session-driver.js`;
      discard foreign snapshots and reset counters after a `STOPPED` surface.
- [x] Add `tests/unit/stale-loop-state-reset.test.mjs` for foreign and `STOPPED`
      snapshots.
- [x] Run `node --test --test-force-exit src/adapters/opencode-v1/session-driver.test.mjs tests/unit/stale-loop-state-reset.test.mjs` (25/25).
- [x] Verify all tests pass with `node --test`
