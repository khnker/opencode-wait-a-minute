# Design — Explicit Task Work Hierarchy

## Research

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) — entity/activity relations and
  ancestry modeling; supports storing links on the entity record rather than in a
  parallel graph.
- [C4 model](https://c4model.com/) — nested levels (context → container → component →
  code) as a mental model for a strictly ordered project → group → task → session chain.
- [Work Breakdown Structure (PMI)](https://www.pmi.org/learning/library/work-breakdown-structure-fundamental-6824)
  — parent/child decomposition with roll-up at the parent level, which motivates
  consolidation into the group rather than into the project base.

## Alternatives considered

### A. Separate hierarchy database/graph file parallel to `task.json`

Rejected. It creates a second source of truth that can drift from the per-task files,
requires its own atomic-write and reconciliation path, and complicates deletion and
legacy tasks. The existing `task.json` is already the source of truth and already has a
best-effort aggregate reconciler, so optional fields on the record are cheaper and safer.

### B. Rewrite `assembly.js` selection to be hierarchy-first now

Rejected for this phase. Selection is part of the context projection path; making it
hierarchy-aware belongs to the projection phase and would be a router rewrite. It also
has a much larger blast radius than adding the hierarchy facts. `assembly.js`,
`context.js`, `context-compaction.js` and the compaction hook are intentionally not
modified here.

## Chosen design

Optional fields on `task.json` plus one deep module (`task-hierarchy.js`):

- `parentId` (optional) links a task to its parent.
- `scope` (optional) is one of the phase 1 `CONTEXT_SCOPE_TYPES`.
- `sessionId` (optional) is only meaningful for `scope: "session"`.

The module owns one small interface — validate a link, set a parent, read ancestry,
inherit constraints, consolidate, resolve effective scope — and hides all traversal,
dedupe, cap and idempotency logic. Missing `scope` is inferred: a root is a `project`,
a linked record is a `task`, so legacy records validate without migration.

Level ordering is strict: `project > group > task > session`. The parent's level must be
shallower than the child's, which also keeps the ancestry finite. Cycle detection runs
before ordering so corrupt pre-existing links still fail safely.

Consolidation writes a `{ taskId, requirementsDone, nextAction, at, sourceUpdatedAt }`
summary under the parent group's `consolidated` array. `sourceUpdatedAt` is the
idempotency key (same task + same source `updatedAt` is a no-op); the array is filtered
by `taskId` and capped at 20. Only the group file is written; the canonical project
base is untouched, and accepted deltas remain the only path into that base.

Dependencies continue to use `task-dependencies.js` as the single graph. No new edge
storage or second traversal is introduced.

## Risks

- Legacy records with a parent but no explicit scope are inferred as `task`; a legacy
  group cannot be recognized without an explicit `scope: "group"`. This is deliberate
  and backward compatible.
- Consolidation is confined to the parent group but is not a transaction across files;
  a failed group write leaves the child untouched and can be retried idempotently.
