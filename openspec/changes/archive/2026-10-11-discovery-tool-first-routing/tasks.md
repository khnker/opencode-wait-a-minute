## 1. Core Logic
- [x] 1.1 Create `src/policy/discovery-classifier.js` to distinguish read-only bash vs justified usage.
- [x] 1.2 Implement nudge logic to suggest `grep`/`glob`/`read`/`context-query-engine` for read-only bash.
## 2. Integration
- [x] 2.1 Wire classifier into `src/execution/runtime-guards.js` (risk-engine.js wiring deferred).
- [x] 2.2 Add `workdir` suggestion logic (`workdirSuggestion`).
## 3. Testing
- [x] 3.1 Create `tests/unit/discovery-classifier.test.mjs`.
- [x] 3.2 Run tests: `node --test tests/unit/discovery-classifier.test.mjs`.
