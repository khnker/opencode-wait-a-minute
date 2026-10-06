# Tasks

## Preparation

- [ ] Verify all previous audit changes are complete.
- [ ] Produce final source ownership map.
- [ ] Produce final test ownership map.
- [ ] Produce benchmark ownership map.
- [ ] Identify public/package entrypoints.
- [ ] Identify OpenCode integration entrypoints.
- [ ] Identify runtime discovery paths.
- [ ] Identify CI assumptions about paths.

## Source Migration

- [ ] Create `src/pillars/preflight`.
- [ ] Create `src/pillars/context`.
- [ ] Create `src/pillars/task`.
- [ ] Create `src/pillars/execution`.
- [ ] Create `src/pillars/verification`.
- [ ] Create `src/pillars/skills`.
- [ ] Create `src/pillars/runtime`.
- [ ] Create `src/orchestration`.
- [ ] Create `src/shared`.
- [ ] Move source files according to ownership map.
- [ ] Update imports.
- [ ] Remove obsolete source locations.
- [ ] Check for circular dependencies.

## Tests

- [ ] Create `tests/unit`.
- [ ] Create `tests/integration`.
- [ ] Create `tests/behavioral`.
- [ ] Create `tests/e2e`.
- [ ] Mirror semantic ownership for unit tests.
- [ ] Move cross-pillar tests to integration/behavioral.
- [ ] Update test configuration.
- [ ] Update test imports.
- [ ] Remove obsolete test locations.

## Benchmarks

- [ ] Create benchmark taxonomy.
- [ ] Move context benchmarks.
- [ ] Move token-efficiency benchmarks.
- [ ] Move lifecycle benchmarks.
- [ ] Move live benchmarks.
- [ ] Move deterministic benchmarks.
- [ ] Update benchmark scripts.
- [ ] Verify benchmark outputs remain comparable.

## Documentation

- [ ] Create `docs/architecture`.
- [ ] Create `docs/concepts`.
- [ ] Create `docs/development`.
- [ ] Create `docs/benchmarks`.
- [ ] Move documentation.
- [ ] Update internal links.
- [ ] Add final repository architecture document.
- [ ] Add ownership rules.
- [ ] Add dependency rules.

## Tooling

- [ ] Move reusable repository scripts to `scripts/`.
- [ ] Update package scripts.
- [ ] Update CI configuration.
- [ ] Update OpenCode integration paths.
- [ ] Update skill discovery paths if required.
- [ ] Update packaging configuration.

## Root Cleanup

- [ ] Identify every root-level implementation file.
- [ ] Move remaining implementation files.
- [ ] Remove obsolete root files.
- [ ] Verify root contains only intentional repository-level files.

## Validation

- [ ] Run typecheck.
- [ ] Run unit tests.
- [ ] Run integration tests.
- [ ] Run behavioral tests.
- [ ] Run E2E tests.
- [ ] Run deterministic benchmarks.
- [ ] Run token-efficiency benchmarks.
- [ ] Run live benchmarks where available.
- [ ] Run `npm test`.
- [ ] Run `npm pack --dry-run`.
- [ ] Inspect package contents.
- [ ] Validate OpenCode integration.
- [ ] Validate `.wam` behavior.
- [ ] Validate skill discovery.
- [ ] Validate CLI/package entrypoints.
- [ ] Validate CI.
- [ ] Execute final RC1 gate.

## Final Documentation

- [ ] Document final repository structure.
- [ ] Document pillar ownership.
- [ ] Document dependency direction.
- [ ] Document shared-module criteria.
- [ ] Document extension workflow.
- [ ] Document benchmark locations.
- [ ] Record migration decisions and exceptions.
