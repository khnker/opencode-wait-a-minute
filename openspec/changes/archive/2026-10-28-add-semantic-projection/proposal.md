## Why

Compaction currently rebuilds context by asking the model to decide which facts from the
transcript survive, which is lossy and non-deterministic. The structured state already
exists (execution ledger, canonical base, task hierarchy, canonical deltas), so the brief
can be projected from that state instead of re-derived from prose.

Phase 6 of the context-curation work: reconstruct a semantic projection from structured
state, not from the model's summary of the transcript.

## What Changes

- Add `src/context/semantic-projection.js`: a pure projection builder plus renderer that
  emits objective, constraints, execution state, live decisions, evidence refs, open items,
  next obligation and retrievable refs.
- Extend `buildContextBrief` with optional `root`, `ledger`, `base` and `constraints`.
  When a ledger/base is available the brief carries projection sections; otherwise the
  legacy brief is returned byte-for-byte unchanged.
- Pass `root` from the `experimental.session.compacting` hook so the brief can load the
  execution ledger and applicable constraints. No other handler restructuring.
- Add tests for the projection, the brief integration and the existing hook contract.

## Impact

- Affected specs: `semantic-projection` (new capability).
- Affected code: `src/context/semantic-projection.js` (new),
  `src/context/context-brief.js`, `index.js` (one argument inside the existing try/catch).
- Unchanged: `src/context/context-compaction.js`, `src/context/assembly.js`, router logic.
- Dependencies: none added.
