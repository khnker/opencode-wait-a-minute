# Proposal: Fix `/wam ctx get` CQE fallback

## Why

`/wam ctx get "<query>"` is advertised in discovery nudges as the CQE/fast path,
but its implementation only searches `.wam/capsules/*.json`. In a fresh project
with no capsules it always returns
`Sin cápsulas para "..." — contexto no disponible (no se fabrica)`, even when the
CQE file index has real matches. The advertised fast path therefore returns
nothing exactly when it is most useful.

## What Changes

- Add `retrieveContextWithCqe(query, { root, maxResults })` in
  `src/context/context.js`: capsule retrieval runs first (deterministic-first),
  then CQE/native file retrieval is used only when no capsule matches.
- Wire `/wam ctx get` to the new helper and render CQE/native items as bounded
  one-line results tagged `[cqe]` or `[wam-native]`.
- Preserve the existing capsule output format and the existing capsule failure
  message when both sources are empty.
- Add a regression test for a fresh project with no capsules.

## Out of Scope

- Changing CQE mode resolution, ranking, or indexing.
- Changing nudge wording or the capsule relevance algorithm.
- Adding new dependencies or new command flags.
