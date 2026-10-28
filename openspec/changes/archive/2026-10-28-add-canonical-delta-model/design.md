# Design: Canonical delta model

## Research

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) — provenance entities,
  activities and agents; invalidation needs who/what caused it.
- [Event Sourcing (Fowler)](https://martinfowler.com/eaaDev/EventSourcing.html)
  — derive current state from an ordered log instead of mutating state in place.
- [Optimistic concurrency control](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
  — version checks at write time instead of locks; stale writes fail, never
  overwrite.

## Alternatives considered

### A. Mutate the CPC markdown directly on compaction (rejected)

Compaction would rewrite `.wam/context/project.md` in place.

- No review boundary: an inferred summary becomes canonical immediately.
- No diff, no `reason`, no `sourceRefs`, no rollback or version lineage.
- Invalidated facts are deleted, losing the provenance of the change.
- A crash mid-write can leave the canonical memo torn.

### B. Store deltas only in the existing journal, no base snapshot (rejected)

The transaction journal already appends operations.

- Reading current truth requires replaying the whole journal.
- Journal GC/compaction would erase the only copy of canonical knowledge.
- No stable `baseVersion` to check optimistic concurrency against.
- Proposals and operational events would share one lifecycle and retention
  policy, although their semantics differ.

### C. Versioned base snapshot + staged proposals (chosen)

A pinned base is the current truth; proposals are staged, validated and applied
as a new version.

- Explicit review boundary (`proposed` → `accepted` / `rejected`).
- O(1) reads of current canonical knowledge and a stable `baseVersion`.
- `previousVersion` gives lineage; invalidated entries stay recoverable.
- Compaction and inference can only propose, never mutate canonical directly.

## Persistence layout

| File | Shape | Why |
|---|---|---|
| `.wam/canonical/base.json` | `{ version, entries, createdAt, previousVersion }` | Current truth, one atomic replace per version. |
| `.wam/canonical/proposals.json` | `Proposal[]` | Small, bounded volume; status transitions rewrite records, so a JSON array under one atomic write is simpler and never torn. A JSONL append log would still need full rewrites for `accepted`/`rejected`. |

History is bounded to the `previousVersion` pointer only (no N-snapshot
archive): invalidated entries remain in the current base with
`invalidatedBy`/`invalidatedAt`, and the proposal list carries the decision trail.
Keeping snapshot files would duplicate knowledge without adding recoverability.

## Chosen design

- **Base shape**:
  `{ version:int, entries:[{ id, kind:"fact"|"assumption", text, section, source, status:"active"|"invalidated", invalidatedBy?, invalidatedAt? }], createdAt, previousVersion }`.
- **Proposal shape**:
  `{ id, createdAt, status:"proposed"|"accepted"|"rejected", baseVersion, reason, sourceRefs:[], ops:[{ op:"add"|"update"|"invalidate", entryId?, entry? }], decidedAt?, decision? }`.
- **Seeding**: when `base.json` is absent, load the CPC memo, build entries with
  the existing parser and pin them as version `0`. The pinned snapshot prevents
  later memo edits from silently changing the base; the delta layer never writes
  the memo.
- **Validation** (`validateDelta`, never throws): proposal exists and is
  `proposed`, `baseVersion` matches the current base, op enum is valid, targets
  exist and are `active`, entry `kind` is valid, and the candidate entries pass
  the existing CPC validator (session-contamination and kind checks; token
  budget is a render concern and is ignored here).
- **Accept**: re-read the base immediately before applying (optimistic
  concurrency), validate, apply ops to a copy, write the new base, then mark the
  proposal accepted. Validation failure writes nothing. The base is written
  first: a crash leaves the proposal `proposed` with a now-stale `baseVersion`,
  so a retry fails safely instead of applying twice.
- **Invalidation semantics**: `invalidate` sets `status:"invalidated"` plus
  `invalidatedBy`/`invalidatedAt`. The entry is never deleted; `materializeBase`
  filters it out, while history stays readable in the base and in proposals.
- **Materialization**: `materializeBase` renders active entries through the
  existing renderer and returns text; it does not touch `.wam/context/project.md`.

## Risks

- Two-file accept is not a cross-file transaction; the ordering above makes the
  only possible partial state fail-safe rather than double-apply.
- `proposals.json` grows with every proposal. It is small compared with the
  journal; pruning can be added once volume warrants it.
