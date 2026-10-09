# Tasks: Establish CQE Integration Contract (CHANGE 01)

- [x] Inspect CQE entrypoint, engine, interpreter, operators, index, cache, and MCP server (`/home/nicolas/dev/contextforge`)
- [x] Inventory existing WAM search and evidence mechanisms (`src/context/`, `src/evidence/`, `src/verification/`)
- [x] Map WAM investigation requirements to CQE operations or identify gaps
- [x] Verify non-side-effectful importability of CQE core (import-safe; CLI guarded by `isMain`)
- [x] Document path resolution, repository isolation, and dependency constraints (`process.cwd()`-only; global cache; external binaries)
- [x] Define the integration contract and typed-error expectations (see `design.md`)
- [x] Produce audit report and viability verdict (`audit.md`)

## Gate to CHANGE 02
- [x] Viability of extraction confirmed: **viable, but factory/per-repo isolation refactor is required**
- Blocking items for CHANGE 02: repository-scoped factory, per-repo cache/index, valid package entry (`main`/`exports`), MCP re-pointed at core, typed errors.
