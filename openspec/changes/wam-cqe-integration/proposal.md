# Proposal: Establish CQE Integration Contract (CHANGE 01)

## Problem
WAM needs to control mandatory file, symbol, reference, and test searches without delegating the entire investigation decision to the agent. CQE contains a retrieval engine, but its importability as a per-repository library, its dependencies, and its isolation guarantees were unproven.

## Solution
Audit both repositories and define a stable integration contract so WAM can invoke CQE as an internal library without starting an MCP server. CQE is imported only through a repository-scoped factory; the MCP server remains a thin adapter over the same engine.

## Findings (see `audit.md`)
- CQE is import-safe (no module-scope side effects; CLI guarded by `isMain`).
- CQE is NOT yet usable as a per-repo library: repo root is `process.cwd()`-only, cache/index are module-global, `package.json` `main: index.js` is missing.
- WAM already owns a context layer (`src/context/`) with `context-source-registry.js` as the source abstraction — the correct injection seam, avoiding duplication.
- **Conclusion:** CHANGE 02 (extract `cqe-core`) is a blocking prerequisite before CHANGE 03.

## Scope
- Audit CQE imports, dependencies, scripts, paths, and side effects. (done)
- Define the programmatic contract (query, chunk retrieval, stats, provenance). (done)
- Map WAM investigation requirements to CQE capabilities. (done)
- Define types, error handling, resource cleanup, and repository isolation. (done)

## Out of scope
- Rewriting the CQE optimizer.
- Migrating all WAM retrieval at once.
- Making CQE the mandatory engine.
- Claiming quality/token improvements before measurement.

## Constraint
No production behavior changed. Read-only audit.
