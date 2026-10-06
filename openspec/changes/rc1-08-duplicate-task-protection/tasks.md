# Tasks

## Implementation
- [x] Context-level dedup exists: `tests/unit/context-tests.test.mjs` (`09_duplicate_context_removed`), `tests/unit/dependency-closure.test.mjs` (node dedup).
- [ ] Task-intent normalization + semantic identity so equivalent intents map to one persisted task id.
- [ ] Persistence-level guard preventing `task-00N` proliferation across repeated equivalent intents.
- [ ] Test asserting repeated equivalent intents yield a single persisted task.

## Validation
- [x] `npm test` passes (existing dedup coverage).
- [x] `openspec validate rc1-08-duplicate-task-protection --strict` passes.
