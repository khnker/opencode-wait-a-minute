# Proposal: Improve CQE query robustness

## Problem

CQE is advertised as the fastest retrieval path, but two deterministic defects
make it fail often:

1. **Stale catalog.** `ensureIndex` only builds the SQLite catalog when the
   database file is missing. Once it exists, every later query reuses it without
   checking freshness, even though the repository changed. In a live session
   this returns old line numbers and misses symbols added after the first build.
   Measured on this repo: 240 files were dirty, `classifyCqeFailure` was absent
   and `selectContextWithCqe` pointed to line 573 instead of 612. A manual
   reconcile fixed both.
2. **False CQP detection.** `engine.query` treats any query starting with
   `FIND|SEARCH|SELECT|LIST` as CQP. Natural-language prompts such as
   `SELECT classifyCqeFailure`, `LIST files in src` or
   `SEARCH for classifyCqeFailure` are routed to the CQP parser, which throws
   `FIND missing`, so CQE returns no evidence and falls back to native search.

## Change

- `ensureIndex` reconciles the catalog when it is older than a bounded TTL and
  `freshness()` reports changed, added or removed files. Clean repositories keep
  reusing the catalog without bumping the index version.
- `createEngine.query` validates CQP input with the parser before executing it.
  A `CqpError` degrades to intent parsing instead of failing the whole query.
- Add regression tests for both behaviors.

## Out of scope

- Changing the CQE mode or the nudge text.
- Replacing the vendor retrieval algorithms.
- Changing the on-disk catalog location.
