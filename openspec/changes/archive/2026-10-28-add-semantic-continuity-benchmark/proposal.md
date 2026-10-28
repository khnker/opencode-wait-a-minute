## Why

Compaction can meet a character budget while silently dropping execution
continuity: a verified requirement loses its id, a superseded decision keeps
masquerading as live, and omitted detail has no retrievable pointer. The
existing `benchmarks/context-curation.test.mjs` only measures size, so a
regression in the semantic projection would pass the suite.

## What Changes

- Add `benchmarks/semantic-continuity.test.mjs`: a deterministic fixture built
  with the real ledger, canonical-delta, retention and task-hierarchy modules,
  comparing the legacy brief against the semantic projection under the same
  4000-character budget and the same eight continuity probes.
- Count total tokens as brief tokens plus recovery tokens for referenced detail
  that is actually re-loaded, so "small brief" cannot win by dropping facts.
- Add the `bench:semantic-continuity` npm script.
- No runtime module changes; no network or model calls.

## Impact

- Affected specs: `semantic-continuity-benchmark`
- Affected code: `benchmarks/semantic-continuity.test.mjs`, `package.json`
