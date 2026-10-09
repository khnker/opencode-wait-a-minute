# Design: CQE Integration Contract (CHANGE 01)

Status: CONTRACT DEFINED (based on real exports — see `audit.md`)

## Contract (mapped to actual CQE exports)

WAM consumes CQE through a thin, repository-scoped factory. The names below reflect what CQE exposes today plus what CHANGE 02 must add (marked ⚠).

- `createEngine({ root, budget, cacheDir, env })` ⚠ (CHANGE 02 to add): returns an instance bound to an explicit `root`; no reliance on `process.cwd()`.
- `query(request)`: wraps `runCQP(cqpText, opts)` / `runIntent(intentText, opts)` (`engine/engine.js:932/:965`) with `root`/`budget`/`cacheDir` threaded per call. Returns `{ plan, results, stats, cached }`.
- `readSpan(request)`: line-range slice, derived from result locations.
- `getCapabilities()`: reports available operators and external-binary availability.
- `dispose()`: releases per-instance resources (replaces global `clearCache()` `engine.js:64`).

## Result model

Preserve CQE's `context-pack.js` container plus evidence fields: relative path, symbol/subject, start/end line, snippet, evidence type, producing operator, executed query, evidence level, token/time estimate, execution status, run id. Deterministic and probabilistic results remain distinguishable; a semantic score cannot erase a deterministic match.

## Responsibility boundary

- CQE: interprets/plans/executes queries; fuses and selects under budget; reports provenance, cost, errors.
- WAM: decides which searches a task requires; verifies investigation was satisfied; keeps `VERIFIED` authority. CQE success ≠ WAM `VERIFIED`.

## Isolation & paths

Each instance knows its target repo. Scripts, indices, temp files and caches resolve against the configured `root`, never `process.cwd()`. No writes into WAM's repo or other repos.

## Cache & index

Cache keys include repo scope + query params. Cross-repo reuse is forbidden. Invalidation is fingerprint-based (not TTL-only). Stale index results must be marked, not presented as confirmed evidence.

## Integration seam in WAM

CQE attaches behind the existing `src/context/context-source-registry.js` source abstraction consumed by `context-retrieval-integration.js` / `context-retrieval.js::retrieveContext`. No parallel retrieval path is created.

## Change decomposition

- CHANGE 02 (`extract-cqe-core`, CQE repo): factory + per-repo isolation + valid package entry; MCP/CLI become adapters.
- CHANGE 03 (`integrate-cqe-wam`, WAM repo): adapter + shadow/enabled modes + fallback.
- CHANGE 04 (`evaluate-cqe-rollout`, WAM repo): comparative evaluation + progressive rollout + rollback.
