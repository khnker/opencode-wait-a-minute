# Proposal: Canonical delta model

## Why

The canonical project context (CPC) is the project's stable, versioned knowledge
base. Today compaction, inference and summarization can only rewrite the memo
document, so an inferred statement can silently replace a verified fact with no
review step, no version lineage and no way to tell what changed or why.

Phase 1 gave context items a semantic envelope (`status`, `retention`, scope).
Phase 2 adds the missing write path: a pinned base snapshot plus staged deltas
that must be validated and explicitly accepted before they become canonical.

## What Changes

- Add `src/context/canonical-deltas.js` with a small interface:
  `loadBase`, `proposeDelta`, `validateDelta`, `acceptDelta`, `rejectDelta`,
  `listDeltas`, `materializeBase`.
- Persist a versioned base snapshot at `.wam/canonical/base.json` and proposals
  at `.wam/canonical/proposals.json`, both via the existing atomic-write helper.
- Seed base version `0` from the existing CPC memo when `base.json` is absent;
  never write the memo from the delta layer.
- Accept applies `add` / `update` / `invalidate` ops to a **new** base version,
  re-reading the base first (optimistic concurrency), and keeps
  `previousVersion`.
- Invalidation marks entries instead of deleting them, so history stays
  recoverable.
- Add regression tests in `src/context/canonical-deltas.test.mjs`.

## Out of scope

- Changing `context-compaction.js`, the compaction hook or the Context Router.
- Auto-materializing accepted deltas back into `.wam/context/project.md`.
- Migrating or rewriting existing CPC documents.
