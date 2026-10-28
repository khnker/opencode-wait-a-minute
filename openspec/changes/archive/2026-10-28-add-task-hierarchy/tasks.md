# Tasks

## 1. Specification

- [x] 1.1 Add the `task-hierarchy` capability spec
- [x] 1.2 Record research links and rejected alternatives in `design.md`

## 2. Implementation

- [x] 2.1 Reuse the phase 1 scope enum instead of duplicating it
- [x] 2.2 Add optional `parentId`, `scope` and `sessionId` handling to task records
- [x] 2.3 Implement `validateTaskLink` (existence, self-parent, cycle, level ordering)
- [x] 2.4 Implement `setTaskParent` through the existing atomic task store
- [x] 2.5 Implement `getAncestry`, `getApplicableConstraints` and `getTaskScope`
- [x] 2.6 Implement bounded, deduped `consolidateTaskToGroup`
- [x] 2.7 Reuse `task-dependencies.js`; add no new edge storage
- [x] 2.8 Leave `assembly.js`, `context.js` and compaction untouched

## 3. Verification

- [x] 3.1 Add `src/state/task-hierarchy.test.mjs`
- [x] 3.2 Run the new test file and existing task-state tests
- [x] 3.3 Run `openspec validate --changes --strict`
- [x] 3.4 Run `npm run build`
