# Proposal: Add a semantic contract for context items

## Why

`normalizeContextItem` currently produces `{ id, content, source, type, timestamp,
scope, relatedRequirements, metadata }`. That shape answers "what was captured" but
not the questions every later phase needs:

- **Semantic identity**: is this a fact, a claim, a decision, an observation?
  Today classification exists in a separate module and its result is not part of
  the item, so consumers must re-classify.
- **Scope**: `scope` is a free-form string (`"LOCAL"`, `"session"`, ...), so an
  item is never bound to a concrete project, group, task or session id.
- **Provenance**: `source` is one opaque label. There is no list of the artifacts
  an item derives from, and no links between items.
- **Validity**: there is no lifecycle. A rejected or superseded item looks
  identical to an accepted one.
- **Retention**: there is no declaration of how long an item should stay hot,
  be archived, or be dropped, so memory growth cannot be bounded by policy.

Without a contract, phases 2-7 (curation, compaction, retrieval, memory, budget,
audit) would each invent their own field names and validation.

## What changes

- Extend `src/context/context-normalization.js` with frozen enums:
  `CONTEXT_KINDS`, `CONTEXT_SCOPE_TYPES`, `CONTEXT_STATUSES`,
  `RETENTION_POLICIES`, `RELATION_TYPES`.
- Add `validateContextItem(item)` returning `{ ok, errors }` (never throws).
- Extend `normalizeContextItem` (exported also as `normalizeItem`) so every item
  carries `kind`, `status`, `retention`, `sourceRefs`, `relations`, `scopeType`
  and `scopeId`, with deterministic defaults derived from existing fields.
- Keep every legacy field and its current value/shape (`scope` stays the original
  string, `type`, `source`, `timestamp`, `content`, `relatedRequirements`,
  `metadata`).
- Add regression tests in `src/context/context-normalization.test.mjs`.

## Out of scope

- Phase 2: curation/selection policy.
- Phase 3: compaction and summarization changes.
- Phase 4: retrieval and ranking.
- Phase 5: persistent memory promotion.
- Phase 6: budget accounting.
- Phase 7: audit and decision records.
- The compaction hook and `context-compaction.js` are untouched.
- The Context Router is untouched.
