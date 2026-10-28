# Proposal: add-retention-policy

## Why

Context items already carry a `retention` policy (`active`, `durable`,
`archivable`, `ephemeral`) and a `relations` graph, but no component turns those
declarations into a decision. Pruning today is either TTL-based (task archival in
`src/persistence/retention-manager.js`) or age/score-based (`pruneContext` in
`src/context/context-compaction.js`). Neither respects relations, so pruning can
drop the only evidence behind a live claim.

## What changes

Add a standalone, pure retention planner in `src/context/retention-policy.js`:

- Build a reference index from `item.relations` (`referencedBy`, `relationsOf`).
- Plan each item into `keep`, `archive`, `discard`, with a `blocked` list for
  items that must not be dropped and the concrete reason.
- Apply a plan into `kept` / `archived` / `discarded` arrays without mutating
  inputs or writing to disk.

## What does not change

- `src/context/context-compaction.js` and the compaction hook.
- `src/persistence/retention-manager.js` (task archival TTL, a different concern).
- `assembly.js` / `context.js` / the router.

Wiring the planner into the projection phase is a later change.

## Impact

- New module + tests only.
- No new dependencies; policies and relation types are imported from
  `context-normalization.js`.
