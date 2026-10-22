# Tasks: Task Identity and Isolation

- [x] Implement `resolveTaskIdentity` in `engine.js` with explicit precedence and session ownership check
- [x] Refactor `runtime/message-handler.js` to use `resolveTaskIdentity` and decouple duplicate detection takeover
- [x] Implement test isolation helper for hermetic `.wam` roots in test suites
- [x] Update `decision-critical-uncertainty.test.mjs` and related test files to use isolated test roots
- [x] Verify all tests pass with `node --test`
