# Tasks: Hide WAM Messages from User Chat Window

- [ ] Task 1: Update `emitTextPart` in `index.js` to route synthetic WAM operational parts into `output.system` (or hidden model context) instead of visible `output.parts`, keeping user-facing chat free of `[wam]` notices during regular turns.
- [ ] Task 2: Ensure final summaries and explicit user requests correctly render task completion and audit logs.
- [ ] Task 3: Update existing tests or add new test assertions to verify `[wam]` notices are stored in hidden system/metadata context rather than polluting visible user chat parts.
- [ ] Task 4: Run test suite and validate openSpec conformance.
