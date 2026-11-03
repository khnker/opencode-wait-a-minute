# Design: Improve CQE query robustness

## Research

- `vendor/context-query-core/README.md`: CQP grammar (`FIND <target> OF <kind> <name>`),
  `runCQP` for declarative queries and `runIntent` for natural language.
- `vendor/context-query-core/src/index-layer/index.js`: the index layer already
  exposes `freshness(repo)` with `state: 'snapshot' | 'dirty_scope'` and
  `changed_paths`, and documents the freshness model as
  "snapshot / dirty_scope / live — nunca evidencia vieja silenciosa".
- `vendor/context-query-core/src/index-layer/indexer.js`: `reconcile` upserts
  added/changed files and removes deleted ones, so it is incremental.
- Node.js `fs.stat` (https://nodejs.org/api/fs.html#fsstatpath-options-callback):
  `mtimeMs` + `size` is the cheap invalidation pair used by the existing
  `freshness()` implementation.
- SQLite FTS5 (https://www.sqlite.org/fts5.html): full rebuilds are expensive;
  incremental upserts plus a dirty check are the standard approach.

## Alternatives

### Catalog freshness

1. Rebuild on every query. Correct but walks and stats the whole repository on
   each CQE call; rejected for latency.
2. Check `freshness()` per process start and reconcile only when dirty, with a
   short TTL between checks (chosen). Bounded staleness, incremental upserts,
   and no index-version churn on clean repos.
3. Invalidate from `git status` / `HEAD`. Cheap but misses filesystem changes
   outside git (untracked files, generated files) and adds a git dependency;
   rejected.

### CQP detection

1. Tighten the `isCqp` regex to require the full grammar. Brittle: it duplicates
   the parser and drifts from it.
2. Validate with `parseCQP` and fall back to `runIntent` on `CqpError` (chosen).
   The parser stays the source of truth; valid CQP is untouched and invalid CQP
   degrades instead of throwing.
3. Rewrite or prefix natural-language text before calling the engine. Rejected:
   it can change symbol extraction and hides the real cause.

## Decision

- `ensureIndex(cwd, { forceBuild, ttlMs })` stores the last reconcile timestamp
  per repository. When the TTL expires it calls `freshness()`; if
  `changed_paths` is non-empty (or `forceBuild` is set) it calls `buildIndex()`,
  which reconciles incrementally.
- `CqpError` gets a stable `name`, and `createEngine.query` parses the query
  before `runCQP`. Only parse errors fall back to `runIntent`; operational
  errors still propagate.

## Risks

- The first indexed query per process now stats the repository once, which is a
  small fixed cost on large repos. `CF_INDEX_TTL_MS` bounds later checks.
- `freshness()` and `buildIndex()` both walk the tree when the catalog is dirty;
  this only happens while files changed and is cheaper than reindexing blindly.
