# Tasks

- [x] 1. Add pure `src/execution/task-loop.js` decision controller
- [x] 2. Add `src/state/loop-state.js` run-scoped persistence (atomic snapshot + append-only events + replay)
- [x] 3. Add `src/adapters/opencode-v1/event-normalizer.js` and `session-driver.js`
- [x] 4. Add `taskLoop` feature flag (default enabled, opt-out) in `wam-config.js`
- [x] 5. Wire `session.idle` through the adapter in `index.js`
- [x] 6. Add unit tests for decisions, persistence, idempotency and recovery
- [x] 7. Run affected tests, `npm run build` and `openspec validate --changes --strict`
