# Change: Explicit Task Work Hierarchy

## Why

Tasks are currently a flat set stored as `.wam/tasks/<taskId>/task.json`. There is no
way to express that work belongs to a project, a group of related tasks, or a session,
so consolidation and constraint scoping have nowhere to live. Phase 1 already defines a
`project | group | task | session` scope enum and phase 2 defines accepted deltas, but
the task model cannot carry either relationship.

## What Changes

- Add optional `parentId`, `scope` and `sessionId` fields to task records. Legacy tasks
  without these fields keep working unchanged.
- Add `src/state/task-hierarchy.js` as a single deep module for link validation
  (existence, self-parent, cycles, level ordering), ancestry resolution, inherited
  project/group constraints, and bounded consolidation into the parent group.
- Reuse the phase 1 scope enum (`CONTEXT_SCOPE_TYPES`) and the existing task store and
  dependency graph. No second graph and no duplicate scope list.
- Consolidation summaries are deduped by `taskId`, capped at 20 and written only to the
  parent group task. The canonical project base is never touched.
- Explicitly out of scope: historical data import, context-router rewrite, and changes
  to `assembly.js`, `context.js`, `context-compaction.js` or the compaction hook.

## Impact

- Affected specs: `task-hierarchy` (new capability)
- Affected code: `src/state/task-hierarchy.js`, `src/state/task-hierarchy.test.mjs`
- Unchanged: task persistence (`task-store.js`), task state normalization, dependency
  graph (`task-dependencies.js`), and the context projection/assembly path
