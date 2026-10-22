# Tasks

## Preparation

- [x] Verify all previous audit changes are complete.
- [x] Produce final source ownership map.
- [x] Produce final test ownership map.
- [x] Produce benchmark ownership map.
- [x] Identify public/package entrypoints.
- [x] Identify OpenCode integration entrypoints.
- [x] Identify runtime discovery paths.
- [x] Identify CI assumptions about paths.

## Source Migration

- [x] Create `src/context`.
- [x] Create `src/cognition`.
- [x] Create `src/execution`.
- [x] Create `src/verification`.
- [x] Create `src/state`.
- [x] Create `src/policy`.
- [x] Create `src/evidence`.
- [x] Create `src/skills`.
- [x] Create `src/persistence`.
- [x] Create `src/integration`.
- [x] Create `src/shared`.
- [x] Move source files according to ownership map.
- [x] Consolidate root-level domain dirs into `src/<domain>/` (policy, task, verification, integration, prompt, rate, recovery, registry, replay, secrets, telemetry, tokens, update, validation, projections).
- [x] Resolve `verification/verification.js` collision (orphaned root stubs removed).
- [x] Update imports.
- [x] Remove obsolete source locations (including the `src/pillars/` container).
- [x] Check for circular dependencies.

## Tests

- [x] Create `tests/unit`.
- [x] Create `tests/integration`.
- [x] Create `tests/behavioral`.
- [x] Create `tests/e2e`.
- [x] Mirror semantic ownership for unit tests.
- [x] Move cross-domain tests to integration/behavioral.
- [x] Update test configuration.
- [x] Update test imports.
- [x] Remove obsolete test locations.

## Benchmarks

- [x] Create benchmark taxonomy.
- [x] Move context benchmarks.
- [x] Move token-efficiency benchmarks.
- [x] Move lifecycle benchmarks.
- [x] Move live benchmarks.
- [x] Move deterministic benchmarks.
- [x] Update benchmark scripts.
- [x] Verify benchmark outputs remain comparable.

## Documentation

- [x] Create `docs/architecture`.
- [x] Create `docs/concepts`.
- [x] Create `docs/development`.
- [x] Create `docs/benchmarks`.
- [x] Move documentation.
- [x] Update internal links.
- [x] Add final repository architecture document.
- [x] Add ownership rules.
- [x] Add dependency rules.

## Tooling

- [x] Move reusable repository scripts to `scripts/`.
- [x] Update package scripts.
- [x] Update CI configuration.
- [x] Update OpenCode integration paths.
- [x] Update skill discovery paths if required.
- [x] Update packaging configuration.

## Root Cleanup

- [x] Identify every root-level implementation file.
- [x] Move remaining implementation files.
- [x] Remove obsolete root files.
- [x] Verify root contains only intentional repository-level files.

## Validation

- [x] Run typecheck.
- [x] Run unit tests.
- [x] Run integration tests.
- [x] Run behavioral tests.
- [x] Run E2E tests.
- [x] Run deterministic benchmarks.
- [x] Run token-efficiency benchmarks.
- [x] Run live benchmarks where available.
- [x] Run `npm test`.
- [x] Run `npm pack --dry-run`.
- [x] Inspect package contents.
- [x] Validate OpenCode integration.
- [x] Validate `.wam` behavior.
- [x] Validate skill discovery.
- [x] Validate CLI/package entrypoints.
- [x] Validate CI.
- [x] Execute final RC1 gate.

## Final Documentation

- [x] Document final repository structure.
- [x] Document domain ownership.
- [x] Document dependency direction.
- [x] Document shared-module criteria.
- [x] Document extension workflow.
- [x] Document benchmark locations.
- [x] Record migration decisions and exceptions.
